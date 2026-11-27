// KiranaVaani conversation engine.
// Takes a customer utterance (voice transcript or typed text) in Tamil,
// Telugu, Hindi, Kannada, English, Malayalam or Marathi and runs the shop
// flow: understand order -> check stock -> suggest a substitute when out of
// stock -> update the running bill -> show a UPI QR on checkout -> log
// every out-of-stock request as a restock signal.
// Replies are always in the language the customer used.
//
// Human touches: confirmations rotate through several phrasings so the
// agent never sounds like a recording; a first unclear turn gets one gentle
// retry, a second one offers the typed box; "same again" / "2 more" re-adds
// the last item without re-asking; the running order is remembered across
// turns.

import { parseIntent } from './intent.js';
import { UNIT_LABELS } from './intent.js';
import { findSubstituteIn, nameIn, ITEMS } from './catalog.js';
import {
  createCart, addToCart, removeFromCart, cartLines, cartTotal, isEmpty, formatINR, round2,
} from './billing.js';
import { buildUpiLink, MERCHANT_VPA, MERCHANT_NAME } from './upi.js';

const R = {
  en: {
    greet: 'Welcome to KiranaVaani! Tell me what you need — for example, "Aashirvaad atta 5 kg".',
    added: [
      (n, q, l, t) => `Added ${q} ${n} — ${l}. Bill so far: ${t}.`,
      (n, q, l, t) => `Got it — ${q} ${n}, ${l}. Running total is ${t}.`,
      (n, q, l, t) => `${q} ${n} is in — ${l}. Your bill stands at ${t}.`,
    ],
    outOfStock: (n, s, p, u) => `${n} is out of stock. I can add ${s} instead at ${p} per ${u}. Shall I? Just say yes.`,
    outOfStockNone: (n) => `${n} is out of stock right now, and I have no substitute for it. I have noted it down for restocking.`,
    partial: (n, a, r) => `Only ${a} of ${n} is left — I added that much. (You asked for ${r}.)`,
    removed: (n, q, t) => `Removed ${q} ${n}. Bill now: ${t}.`,
    notInBill: (n) => `${n} is not in your bill.`,
    removeWhat: 'What should I remove from the bill?',
    bill: (lines, t) => `Your bill:\n${lines}\nTotal: ${t}. Say "pay" when you are ready — I will show the UPI QR.`,
    billEmpty: 'Your bill is empty. Tell me what you need!',
    checkout: (t) => `Total is ${t}. Scan the UPI QR to pay. Thank you for shopping at KiranaVaani!`,
    checkoutEmpty: 'Nothing to pay yet — your bill is empty.',
    yesAdded: [
      (n, q, t) => `Done — added ${q} ${n}. Bill now: ${t}.`,
      (n, q, t) => `Added it — ${q} ${n}. Your bill is now ${t}.`,
    ],
    yesNothing: 'Sure! Anything else you would like?',
    noOk: 'No problem. Let me know what else you need.',
    unknown: 'I did not catch that. Try "2 kg rice", "remove sugar", "bill", or "pay".',
    unknownRepeat: 'Still not clear — no problem. Type it in the box below instead; typing works in every language. For example: "2 kg rice".',
    repeatNone: 'Nothing to repeat yet — tell me what you need first.',
  },
  ta: {
    greet: 'வணக்கம்! கிராணாவாணிக்கு வருக! என்ன வேணும் சொல்லுங்க — உதாரணம்: "ஆசீர்வாத் ஆட்டா 5 கிலோ".',
    added: [
      (n, q, l, t) => `${q} ${n} சேர்த்தாச்சு — ${l}. இதுவரை பில்: ${t}.`,
      (n, q, l, t) => `சரிங்க — ${q} ${n}, ${l}. மொத்த பில் இப்ப ${t}.`,
      (n, q, l, t) => `${q} ${n} வச்சுட்டேன் — ${l}. பில் இதுவரை ${t}.`,
    ],
    outOfStock: (n, s, p, u) => `${n} ஸ்டாக் இல்லை. அதுக்கு பதிலா ${s} சேர்க்கவா? (${p} / ${u}) சரின்னு சொல்லுங்க.`,
    outOfStockNone: (n) => `${n} இப்ப ஸ்டாக் இல்லை, அதுக்கு மாற்று எதுவும் இல்லை. மறுபடியும் வாங்க குறிச்சு வச்சுட்டேன்.`,
    partial: (n, a, r) => `${n} ${a} தான் இருக்கு — அதை சேர்த்துட்டேன். (நீங்க ${r} கேட்டீங்க.)`,
    removed: (n, q, t) => `${q} ${n} எடுத்துட்டேன். இப்ப பில்: ${t}.`,
    notInBill: (n) => `${n} பில்லில் இல்லை.`,
    removeWhat: 'பில்லில் இருந்து எதை எடுக்கணும்?',
    bill: (lines, t) => `உங்க பில்:\n${lines}\nமொத்தம்: ${t}. பணம் கட்ட "pay"னு சொல்லுங்க — UPI QR காட்டுறேன்.`,
    billEmpty: 'பில் காலியா இருக்கு. என்ன வேணும்னு சொல்லுங்க!',
    checkout: (t) => `மொத்தம் ${t}. UPI QR-ஐ ஸ்கேன் பண்ணி பணம் கட்டுங்க. கிராணாவாணியில் வாங்கியதற்கு நன்றி!`,
    checkoutEmpty: 'கட்ட எதுவும் இல்லை — பில் காலி.',
    yesAdded: [
      (n, q, t) => `சரி — ${q} ${n} சேர்த்துட்டேன். இப்ப பில்: ${t}.`,
      (n, q, t) => `சேர்த்துட்டேன் — ${q} ${n}. இப்ப பில்: ${t}.`,
    ],
    yesNothing: 'சரி! வேற ஏதாவது வேணுமா?',
    noOk: 'பரவாயில்லை. வேற என்ன வேணும்னு சொல்லுங்க.',
    unknown: 'புரியலை. "2 கிலோ அரிசி", "சர்க்கரை வேண்டாம்", "பில்", "pay" — இப்படி சொல்லிப் பாருங்க.',
    unknownRepeat: 'இன்னும் புரியலை. கீழே உள்ள பெட்டியில் டைப் பண்ணிப் பாருங்க — எந்த மொழியிலும் டைப் பண்ணலாம். உதாரணம்: "2 கிலோ அரிசி".',
    repeatNone: 'இன்னும் எதுவும் வாங்கலை — முதல்ல என்ன வேணும்னு சொல்லுங்க.',
  },
  te: {
    greet: 'నమస్కారం! కిరాణావాణికి స్వాగతం. ఏం కావాలో చెప్పండి — ఉదాహరణ: "ఆశీర్వాద్ గోధుమ పిండి 5 కిలోలు".',
    added: [
      (n, q, l, t) => `${q} ${n} చేర్చాను — ${l}. ఇప్పటివరకు బిల్లు: ${t}.`,
      (n, q, l, t) => `సరే — ${q} ${n}, ${l}. మొత్తం బిల్లు ఇప్పుడు ${t}.`,
      (n, q, l, t) => `${q} ${n} వేశాను — ${l}. బిల్లు ఇప్పటివరకు ${t}.`,
    ],
    outOfStock: (n, s, p, u) => `${n} స్టాక్ లేదు. దానికి బదులు ${s} చేర్చమంటారా? (${p} / ${u}) సరే అని చెప్పండి.`,
    outOfStockNone: (n) => `${n} ఇప్పుడు స్టాక్ లేదు, దానికి ప్రత్యామ్నాయం కూడా లేదు. మళ్లీ తెప్పించడానికి గుర్తు పెట్టుకున్నాను.`,
    partial: (n, a, r) => `${n} ${a} మాత్రమే ఉంది — అంతే చేర్చాను. (మీరు ${r} అడిగారు.)`,
    removed: (n, q, t) => `${q} ${n} తీసేశాను. ఇప్పుడు బిల్లు: ${t}.`,
    notInBill: (n) => `${n} బిల్లులో లేదు.`,
    removeWhat: 'బిల్లు నుంచి ఏం తీసేయాలి?',
    bill: (lines, t) => `మీ బిల్లు:\n${lines}\nమొత్తం: ${t}. చెల్లించడానికి "pay" అని చెప్పండి — UPI QR చూపిస్తాను.`,
    billEmpty: 'బిల్లు ఖాళీగా ఉంది. ఏం కావాలో చెప్పండి!',
    checkout: (t) => `మొత్తం ${t}. UPI QR స్కాన్ చేసి చెల్లించండి. కిరాణావాణిలో కొన్నందుకు ధన్యవాదాలు!`,
    checkoutEmpty: 'చెల్లించడానికి ఏమీ లేదు — బిల్లు ఖాళీ.',
    yesAdded: [
      (n, q, t) => `సరే — ${q} ${n} చేర్చాను. ఇప్పుడు బిల్లు: ${t}.`,
      (n, q, t) => `చేర్చాను — ${q} ${n}. ఇప్పుడు బిల్లు: ${t}.`,
    ],
    yesNothing: 'సరే! ఇంకేమైనా కావాలా?',
    noOk: 'పర్లేదు. ఇంకేం కావాలో చెప్పండి.',
    unknown: 'అర్థం కాలేదు. "2 కిలోల బియ్యం", "చక్కెర వద్దు", "బిల్లు", "pay" — ఇలా చెప్పి చూడండి.',
    unknownRepeat: 'ఇంకా అర్థం కాలేదు. కింద ఉన్న పెట్టెలో టైప్ చేసి చూడండి — ఏ భాషలోనైనా టైప్ చేయవచ్చు. ఉదాహరణ: "2 కిలోల బియ్యం".',
    repeatNone: 'ఇంకా ఏమీ కొనలేదు — ముందు ఏం కావాలో చెప్పండి.',
  },
  hi: {
    greet: 'नमस्ते! किराणावाणी में स्वागत है। आपको क्या चाहिए बताइए — जैसे: "आशीर्वाद आटा 5 किलो".',
    added: [
      (n, q, l, t) => `${q} ${n} जोड़ दिया — ${l}. अभी तक का बिल: ${t}.`,
      (n, q, l, t) => `ठीक है — ${q} ${n}, ${l}. कुल बिल अब ${t} है।`,
      (n, q, l, t) => `${q} ${n} रख दिया — ${l}. अभी तक का बिल ${t} है।`,
    ],
    outOfStock: (n, s, p, u) => `${n} स्टॉक में नहीं है। इसकी जगह ${s} जोड़ दूँ? (${p} / ${u}) हाँ कहिए।`,
    outOfStockNone: (n) => `${n} अभी स्टॉक में नहीं है और इसका कोई विकल्प भी नहीं है। दोबारा मँगवाने के लिए नोट कर लिया है।`,
    partial: (n, a, r) => `${n} सिर्फ ${a} ही बचा है — उतना ही जोड़ दिया। (आपने ${r} माँगा था।)`,
    removed: (n, q, t) => `${q} ${n} हटा दिया। अब बिल: ${t}.`,
    notInBill: (n) => `${n} बिल में नहीं है।`,
    removeWhat: 'बिल से क्या हटाऊँ?',
    bill: (lines, t) => `आपका बिल:\n${lines}\nकुल: ${t}. भुगतान के लिए "pay" कहिए — UPI QR दिखाऊँगा।`,
    billEmpty: 'बिल खाली है। क्या चाहिए बताइए!',
    checkout: (t) => `कुल ${t} है। UPI QR स्कैन करके भुगतान कीजिए। किराणावाणी से खरीदारी के लिए धन्यवाद!`,
    checkoutEmpty: 'अभी कुछ देना नहीं है — बिल खाली है।',
    yesAdded: [
      (n, q, t) => `ठीक है — ${q} ${n} जोड़ दिया। अब बिल: ${t}.`,
      (n, q, t) => `जोड़ दिया — ${q} ${n}. अब बिल: ${t}.`,
    ],
    yesNothing: 'ठीक है! और कुछ चाहिए?',
    noOk: 'कोई बात नहीं। और क्या चाहिए बताइए।',
    unknown: 'समझ नहीं आया। "2 किलो चावल", "चीनी नहीं चाहिए", "बिल" या "pay" — ऐसे कहकर देखिए।',
    unknownRepeat: 'अभी भी समझ नहीं आया। नीचे वाले बॉक्स में लिखकर देखिए — किसी भी भाषा में लिख सकते हैं। जैसे: "2 किलो चावल".',
    repeatNone: 'अभी कुछ भी नहीं लिया — पहले बताइए क्या चाहिए।',
  },
  kn: {
    greet: 'ನಮಸ್ಕಾರ! ಕಿರಾಣಾವಾಣಿಗೆ ಸ್ವಾಗತ. ನಿಮಗೆ ಏನು ಬೇಕು ಹೇಳಿ — ಉದಾಹರಣೆ: "ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು 5 ಕಿಲೋ".',
    added: [
      (n, q, l, t) => `${q} ${n} ಸೇರಿಸಿದ್ದೇನೆ — ${l}. ಇಲ್ಲಿಯವರೆಗಿನ ಬಿಲ್: ${t}.`,
      (n, q, l, t) => `ಸರಿ — ${q} ${n}, ${l}. ಒಟ್ಟು ಬಿಲ್ ಈಗ ${t}.`,
      (n, q, l, t) => `${q} ${n} ಇಟ್ಟಿದ್ದೇನೆ — ${l}. ಇಲ್ಲಿಯವರೆಗಿನ ಬಿಲ್ ${t}.`,
    ],
    outOfStock: (n, s, p, u) => `${n} ಸ್ಟಾಕ್‌ನಲ್ಲಿ ಇಲ್ಲ. ಅದರ ಬದಲು ${s} ಸೇರಿಸಲೇ? (${p} / ${u}) ಹೌದು ಅನ್ನಿ.`,
    outOfStockNone: (n) => `${n} ಈಗ ಸ್ಟಾಕ್‌ನಲ್ಲಿ ಇಲ್ಲ, ಅದಕ್ಕೆ ಬದಲಿ ಕೂಡ ಇಲ್ಲ. ಮತ್ತೆ ತರಿಸಲು ಗುರುತು ಮಾಡಿಟ್ಟಿದ್ದೇನೆ.`,
    partial: (n, a, r) => `${n} ${a} ಮಾತ್ರ ಇದೆ — ಅಷ್ಟನ್ನೇ ಸೇರಿಸಿದ್ದೇನೆ. (ನೀವು ${r} ಕೇಳಿದ್ದೀರಿ.)`,
    removed: (n, q, t) => `${q} ${n} ತೆಗೆದಿದ್ದೇನೆ. ಈಗಿನ ಬಿಲ್: ${t}.`,
    notInBill: (n) => `${n} ಬಿಲ್‌ನಲ್ಲಿ ಇಲ್ಲ.`,
    removeWhat: 'ಬಿಲ್‌ನಿಂದ ಏನು ತೆಗೆಯಬೇಕು?',
    bill: (lines, t) => `ನಿಮ್ಮ ಬಿಲ್:\n${lines}\nಒಟ್ಟು: ${t}. ಪಾವತಿಗೆ "pay" ಅನ್ನಿ — UPI QR ತೋರಿಸುತ್ತೇನೆ.`,
    billEmpty: 'ಬಿಲ್ ಖಾಲಿ ಇದೆ. ಏನು ಬೇಕು ಹೇಳಿ!',
    checkout: (t) => `ಒಟ್ಟು ${t}. UPI QR ಸ್ಕ್ಯಾನ್ ಮಾಡಿ ಪಾವತಿಸಿ. ಕಿರಾಣಾವಾಣಿಯಲ್ಲಿ ಖರೀದಿಸಿದ್ದಕ್ಕೆ ಧನ್ಯವಾದಗಳು!`,
    checkoutEmpty: 'ಪಾವತಿಸಲು ಏನೂ ಇಲ್ಲ — ಬಿಲ್ ಖಾಲಿ.',
    yesAdded: [
      (n, q, t) => `ಸರಿ — ${q} ${n} ಸೇರಿಸಿದ್ದೇನೆ. ಈಗಿನ ಬಿಲ್: ${t}.`,
      (n, q, t) => `ಸೇರಿಸಿದ್ದೇನೆ — ${q} ${n}. ಈಗಿನ ಬಿಲ್: ${t}.`,
    ],
    yesNothing: 'ಸರಿ! ಬೇರೆ ಏನಾದರೂ ಬೇಕಾ?',
    noOk: 'ಪರವಾಗಿಲ್ಲ. ಬೇರೆ ಏನು ಬೇಕು ಹೇಳಿ.',
    unknown: 'ಅರ್ಥವಾಗಲಿಲ್ಲ. "2 ಕಿಲೋ ಅಕ್ಕಿ", "ಸಕ್ಕರೆ ಬೇಡ", "ಬಿಲ್" ಅಥವಾ "pay" — ಹೀಗೆ ಹೇಳಿ ನೋಡಿ.',
    unknownRepeat: 'ಇನ್ನೂ ಅರ್ಥವಾಗಲಿಲ್ಲ. ಕೆಳಗಿನ ಪೆಟ್ಟಿಗೆಯಲ್ಲಿ ಟೈಪ್ ಮಾಡಿ ನೋಡಿ — ಯಾವ ಭಾಷೆಯಲ್ಲೂ ಟೈಪ್ ಮಾಡಬಹುದು. ಉದಾಹರಣೆ: "2 ಕಿಲೋ ಅಕ್ಕಿ".',
    repeatNone: 'ಇನ್ನೂ ಏನೂ ತೆಗೆದುಕೊಂಡಿಲ್ಲ — ಮೊದಲು ಏನು ಬೇಕು ಹೇಳಿ.',
  },
  ml: {
    greet: 'നമസ്കാരം! കിരാണാവാണിയിലേക്ക് സ്വാഗതം. എന്താണ് വേണ്ടതെന്ന് പറയൂ — ഉദാഹരണം: "ആശിർവാദ് ആട്ട 5 കിലോ".',
    added: [
      (n, q, l, t) => `${q} ${n} ചേർത്തു — ${l}. ഇതുവരെയുള്ള ബിൽ: ${t}.`,
      (n, q, l, t) => `ശരി — ${q} ${n}, ${l}. മൊത്തം ബിൽ ഇപ്പോൾ ${t}.`,
      (n, q, l, t) => `${q} ${n} വെച്ചു — ${l}. ബിൽ ഇതുവരെ ${t}.`,
    ],
    outOfStock: (n, s, p, u) => `${n} സ്റ്റോക്കില്ല. അതിന് പകരം ${s} ചേർക്കട്ടെ? (${p} / ${u}) ശരി എന്ന് പറയൂ.`,
    outOfStockNone: (n) => `${n} ഇപ്പോൾ സ്റ്റോക്കില്ല, അതിന് പകരക്കാരനും ഇല്ല. വീണ്ടും വാങ്ങാൻ കുറിച്ചു വെച്ചു.`,
    partial: (n, a, r) => `${n} ${a} മാത്രമേ ഉള്ളൂ — അത്രയും ചേർത്തു. (നിങ്ങൾ ${r} ചോദിച്ചു.)`,
    removed: (n, q, t) => `${q} ${n} എടുത്തു. ഇപ്പോൾ ബിൽ: ${t}.`,
    notInBill: (n) => `${n} ബില്ലിൽ ഇല്ല.`,
    removeWhat: 'ബില്ലിൽ നിന്ന് എന്താണ് എടുക്കേണ്ടത്?',
    bill: (lines, t) => `നിങ്ങളുടെ ബിൽ:\n${lines}\nമൊത്തം: ${t}. പണം അടയ്ക്കാൻ "pay" എന്ന് പറയൂ — UPI QR കാണിക്കാം.`,
    billEmpty: 'ബിൽ കാലിയാണ്. എന്താണ് വേണ്ടതെന്ന് പറയൂ!',
    checkout: (t) => `മൊത്തം ${t}. UPI QR സ്കാൻ ചെയ്ത് പണം അടയ്ക്കൂ. കിരാണാവാണിയിൽ നിന്ന് വാങ്ങിയതിന് നന്ദി!`,
    checkoutEmpty: 'അടയ്ക്കാൻ ഒന്നുമില്ല — ബിൽ കാലി.',
    yesAdded: [
      (n, q, t) => `ശരി — ${q} ${n} ചേർത്തു. ഇപ്പോൾ ബിൽ: ${t}.`,
      (n, q, t) => `ചേർത്തു — ${q} ${n}. ഇപ്പോൾ ബിൽ: ${t}.`,
    ],
    yesNothing: 'ശരി! വേറെ എന്തെങ്കിലും വേണോ?',
    noOk: 'കുഴപ്പമില്ല. വേറെ എന്താണ് വേണ്ടതെന്ന് പറയൂ.',
    unknown: 'മനസ്സിലായില്ല. "2 കിലോ അരി", "പഞ്ചസാര വേണ്ട", "ബിൽ", "pay" — ഇങ്ങനെ പറഞ്ഞ് നോക്കൂ.',
    unknownRepeat: 'ഇപ്പോഴും മനസ്സിലായില്ല. താഴെയുള്ള പെട്ടിയിൽ ടൈപ്പ് ചെയ്ത് നോക്കൂ — ഏത് ഭാഷയിലും ടൈപ്പ് ചെയ്യാം. ഉദാഹരണം: "2 കിലോ അരി".',
    repeatNone: 'ഇതുവരെ ഒന്നും വാങ്ങിയിട്ടില്ല — ആദ്യം എന്താണ് വേണ്ടതെന്ന് പറയൂ.',
  },
  mr: {
    greet: 'नमस्कार! किराणावाणीत स्वागत आहे. तुम्हाला काय हवं ते सांगा — उदाहरण: "आशीर्वाद आटा 5 किलो".',
    added: [
      (n, q, l, t) => `${q} ${n} जोडलं — ${l}. आतापर्यंतचं बिल: ${t}.`,
      (n, q, l, t) => `ठीक आहे — ${q} ${n}, ${l}. एकूण बिल आता ${t}.`,
      (n, q, l, t) => `${q} ${n} ठेवलं — ${l}. बिल आतापर्यंत ${t}.`,
    ],
    outOfStock: (n, s, p, u) => `${n} स्टॉकमध्ये नाही. त्याऐवजी ${s} जोडू का? (${p} / ${u}) होय म्हणा.`,
    outOfStockNone: (n) => `${n} सध्या स्टॉकमध्ये नाही आणि त्याला पर्यायही नाही. पुन्हा मागवण्यासाठी नोंद करून ठेवली आहे.`,
    partial: (n, a, r) => `${n} फक्त ${a} उरलंय — तेवढंच जोडलं. (तुम्ही ${r} मागितलं होतं.)`,
    removed: (n, q, t) => `${q} ${n} काढलं. आता बिल: ${t}.`,
    notInBill: (n) => `${n} बिलात नाही.`,
    removeWhat: 'बिलातून काय काढायचं?',
    bill: (lines, t) => `तुमचं बिल:\n${lines}\nएकूण: ${t}. पैसे भरायला "pay" म्हणा — UPI QR दाखवतो.`,
    billEmpty: 'बिल रिकामं आहे. काय हवं ते सांगा!',
    checkout: (t) => `एकूण ${t}. UPI QR स्कॅन करून पैसे भरा. किराणावाणीतून खरेदी केल्याबद्दल धन्यवाद!`,
    checkoutEmpty: 'भरायला काही नाही — बिल रिकामं आहे.',
    yesAdded: [
      (n, q, t) => `ठीक आहे — ${q} ${n} जोडलं. आता बिल: ${t}.`,
      (n, q, t) => `जोडलं — ${q} ${n}. आता बिल: ${t}.`,
    ],
    yesNothing: 'ठीक आहे! आणखी काही हवंय का?',
    noOk: 'हरकत नाही. आणखी काय हवं ते सांगा.',
    unknown: 'समजलं नाही. "2 किलो तांदूळ", "साखर नको", "बिल" किंवा "pay" — असं म्हणून बघा.',
    unknownRepeat: 'अजूनही समजलं नाही. खालच्या बॉक्समध्ये टाइप करून बघा — कोणत्याही भाषेत टाइप करता येईल. उदाहरण: "2 किलो तांदूळ".',
    repeatNone: 'अजून काही घेतलं नाही — आधी काय हवं ते सांगा.',
  },
};

function qtyText(qty, unit, lang) {
  const label = (UNIT_LABELS[unit] && UNIT_LABELS[unit][lang]) || unit;
  const q = Number.isInteger(qty) ? String(qty) : String(qty);
  return label ? `${q} ${label}` : q;
}

export class KiranaAgent {
  // items: this shop's shelf (per-shop stock/prices) — defaults to the
  // shared catalogue. vpa/merchantName: this shop's UPI identity for the QR.
  // The shelf is cloned per agent: the agent's stock really depletes as
  // items are added (and comes back on remove), so the shared catalogue is
  // never mutated and two agents never share one shelf.
  constructor({ items = ITEMS, vpa = MERCHANT_VPA, merchantName = MERCHANT_NAME } = {}) {
    this.items = items.map((i) => ({ ...i }));
    this._initialStock = new Map(this.items.map((i) => [i.id, i.stock]));
    this.byId = new Map(this.items.map((i) => [i.id, i]));
    this.vpa = vpa;
    this.merchantName = merchantName;
    this.cart = createCart();
    this.signals = []; // restock signals: { at, itemId, name, requestedQty, available, lang }
    this.pendingSuggestions = []; // queue of { item, qty, forItem } awaiting a yes/no
    this.lastAdded = null; // { item, qty, unit } — for "same again" / "2 more"
    this.unknownStreak = 0; // consecutive unclear turns
    this._addedCount = 0; // confirmation-variety rotation
    this._yesAddedCount = 0;
  }

  // The offer on the table right now (first in the queue), or null.
  get pendingSuggestion() {
    return this.pendingSuggestions[0] || null;
  }

  reset() {
    this.cart = createCart();
    this.signals = [];
    this.pendingSuggestions = [];
    this.lastAdded = null;
    this.unknownStreak = 0;
    this._addedCount = 0;
    this._yesAddedCount = 0;
    // A full reset puts the shelf back the way it was.
    for (const item of this.items) item.stock = this._initialStock.get(item.id);
  }

  // A new customer at the counter: fresh bill and fresh memory — but the
  // shop's restock signals stay, and the shelf stays depleted, because the
  // shop really did sell those goods.
  startNewSession() {
    this.cart = createCart();
    this.pendingSuggestions = [];
    this.lastAdded = null;
    this.unknownStreak = 0;
    this._addedCount = 0;
    this._yesAddedCount = 0;
  }

  // The shelf depletes as items are added, and comes back when they are
  // removed — otherwise the same 50 kg of sugar could be sold forever.
  _decrementStock(item, qty) {
    item.stock = Math.max(0, round2(item.stock - qty));
  }

  _restoreStock(item, qty) {
    const initial = this._initialStock.get(item.id);
    item.stock = Math.min(initial === undefined ? item.stock + qty : initial, round2(item.stock + qty));
  }

  _offerSuggestion(sub, qty, forItem) {
    this.pendingSuggestions.push({ item: sub, qty, forItem });
  }

  _takeSuggestion() {
    return this.pendingSuggestions.shift() || null;
  }

  // The "shall I?" line for one pending offer, in the customer's language.
  _offerText(t, lang, forItem, sub, qty) {
    return t.outOfStock(
      nameIn(forItem, lang), nameIn(sub, lang), formatINR(sub.price),
      (UNIT_LABELS[sub.unit] && UNIT_LABELS[sub.unit][lang]) || sub.unit,
    );
  }

  // Declining an offer: if another offer is waiting behind it, present that
  // one instead of just saying "no problem" — the customer was already
  // offered it in the same reply.
  _declineReply(t, lang) {
    this._takeSuggestion();
    if (this.pendingSuggestions.length > 0) {
      const next = this.pendingSuggestions[0];
      return this._offerText(t, lang, next.forItem, next.item, next.qty);
    }
    return t.noOk;
  }

  setQuantity(itemId, rawQuantity) {
    const item = this.byId.get(itemId);
    const qty = Number(rawQuantity);
    const current = this.cart[itemId]?.qty || 0;
    if (!item || String(rawQuantity).trim() === '' || !Number.isFinite(qty) || qty < 0 || round2(qty) !== qty ||
        (!['kg', 'litre', 'dozen'].includes(item.unit) && !Number.isInteger(qty))) {
      throw new Error('Enter a valid quantity for this item.');
    }
    const change = round2(qty - current);
    if (change > item.stock) throw new Error(`Only ${item.stock} ${item.unit} left on the shelf.`);
    if (change > 0) {
      addToCart(this.cart, item, change);
      this._decrementStock(item, change);
      this.lastAdded = { item, qty: change, unit: item.unit };
    } else if (change < 0) {
      removeFromCart(this.cart, item, -change);
      this._restoreStock(item, -change);
    }
  }

  get total() {
    return cartTotal(this.cart);
  }

  get lines() {
    return cartLines(this.cart);
  }

  billText(lang) {
    return this.lines
      .map((l) => `• ${nameIn(l.item, lang)} — ${qtyText(l.qty, l.item.unit, lang)} × ${formatINR(l.item.price)} = ${formatINR(l.total)}`)
      .join('\n');
  }

  upiLink() {
    return this.total > 0
      ? buildUpiLink({ pa: this.vpa, pn: this.merchantName, amount: this.total })
      : null;
  }

  logSignal(item, requestedQty, lang) {
    this.signals.push({
      at: new Date().toISOString(),
      itemId: item.id,
      name: item.names.en,
      requestedQty,
      available: item.stock,
      lang,
    });
  }

  // Confirmation variety: rotate through the phrasings so the agent never
  // sounds like a recording. Deterministic rotation, not random — the same
  // conversation always reads the same way.
  _pickAdded(t) {
    const variants = t.added;
    return variants[this._addedCount++ % variants.length];
  }

  _pickYesAdded(t) {
    const variants = t.yesAdded;
    return variants[this._yesAddedCount++ % variants.length];
  }

  process(rawText, uiLang = 'en') {
    const intent = parseIntent(rawText, uiLang);
    const lang = intent.lang;
    const t = R[lang];
    // Any understood turn clears the unclear streak.
    if (intent.action !== 'unknown') this.unknownStreak = 0;
    // Intent matching works on names (identical across shops); remap the
    // matched items to THIS shop's shelf so stock/prices are the shop's own.
    const shopItems = (intent.items || []).map(({ item, qty, unit }) => ({
      item: this.byId.get(item.id) || item, qty, unit,
    }));
    intent.items = shopItems;
    const base = { reply: '', lang, action: intent.action, lines: this.lines, total: this.total, upiLink: null, showQR: false, suggestion: this.pendingSuggestion };

    if (intent.action === 'greet') {
      return { ...base, reply: t.greet };
    }

    if (intent.action === 'bill') {
      if (isEmpty(this.cart)) return { ...base, reply: t.billEmpty };
      return { ...base, reply: t.bill(this.billText(lang), formatINR(this.total)), upiLink: this.upiLink(), showQR: true };
    }

    if (intent.action === 'checkout') {
      if (isEmpty(this.cart)) return { ...base, reply: t.checkoutEmpty };
      return { ...base, reply: t.checkout(formatINR(this.total)), upiLink: this.upiLink(), showQR: true };
    }

    if (intent.action === 'yes') {
      if (this.pendingSuggestions.length > 0) {
        const { item, qty, forItem } = this._takeSuggestion();
        const available = Math.min(qty, item.stock);
        if (available < qty) this.logSignal(item, qty, lang);
        if (available > 0) this.setQuantity(item.id, round2((this.cart[item.id]?.qty || 0) + available));
        let reply = available === 0 ? t.outOfStockNone(nameIn(item, lang))
          : available < qty ? t.partial(nameIn(item, lang), qtyText(available, item.unit, lang), qtyText(qty, item.unit, lang))
            : this._pickYesAdded(t)(nameIn(item, lang), qtyText(qty, item.unit, lang), formatINR(this.total));
        // Another offer was waiting behind this one — present it now, so a
        // second "yes" does something the customer was already told about.
        if (this.pendingSuggestions.length > 0) {
          const next = this.pendingSuggestions[0];
          reply += ` ${this._offerText(t, lang, next.forItem, next.item, next.qty)}`;
        }
        return { ...base, reply, lines: this.lines, total: this.total, suggestion: this.pendingSuggestion };
      }
      return { ...base, reply: t.yesNothing };
    }

    if (intent.action === 'no') {
      if (this.pendingSuggestions.length > 0) {
        return { ...base, reply: this._declineReply(t, lang), suggestion: this.pendingSuggestion };
      }
      return { ...base, reply: t.noOk };
    }

    if (intent.action === 'remove') {
      // "Vendu / nako" with no item named usually means "no" to the offer
      // on the table — decline the pending suggestion instead of asking
      // "remove what?".
      if (intent.items.length === 0 && this.pendingSuggestions.length > 0) {
        return { ...base, reply: this._declineReply(t, lang), suggestion: this.pendingSuggestion };
      }
      if (intent.items.length === 0) return { ...base, reply: t.removeWhat };
      const parts = [];
      for (const { item, qty } of intent.items) {
        const { removed } = removeFromCart(this.cart, item, qty);
        if (removed > 0) {
          this._restoreStock(item, removed);
          parts.push(t.removed(nameIn(item, lang), qtyText(removed, item.unit, lang), formatINR(this.total)));
        } else {
          parts.push(t.notInBill(nameIn(item, lang)));
        }
      }
      return { ...base, reply: parts.join(' '), lines: this.lines, total: this.total };
    }

    if (intent.action === 'repeat') {
      if (!this.lastAdded) return { ...base, reply: t.repeatNone };
      const { item, qty: lastQty, unit } = this.lastAdded;
      const qty = intent.repeatQty || lastQty;
      if (item.stock <= 0) {
        this.logSignal(item, qty, lang);
        const sub = findSubstituteIn(item, this.items);
        if (sub) {
          this._offerSuggestion(sub, qty, item);
          return { ...base, reply: this._offerText(t, lang, item, sub, qty), suggestion: this.pendingSuggestion };
        }
        return { ...base, reply: t.outOfStockNone(nameIn(item, lang)) };
      }
      const addQty = Math.min(qty, item.stock);
      addToCart(this.cart, item, addQty);
      this._decrementStock(item, addQty);
      this.lastAdded = { item, qty: addQty, unit };
      // Short fill on a repeat is still a short fill — say so, like the
      // normal add path does, instead of quietly adding less.
      const reply = addQty < qty
        ? t.partial(nameIn(item, lang), qtyText(addQty, item.unit, lang), qtyText(qty, item.unit, lang))
        : this._pickAdded(t)(nameIn(item, lang), qtyText(addQty, item.unit, lang), formatINR(item.price * addQty), formatINR(this.total));
      return { ...base, reply, lines: this.lines, total: this.total };
    }

    if (intent.action === 'add') {
      const parts = [];
      for (const { item, qty } of intent.items) {
        const name = nameIn(item, lang);
        if (item.stock <= 0) {
          this.logSignal(item, qty, lang);
          const sub = findSubstituteIn(item, this.items);
          if (sub) {
            this._offerSuggestion(sub, qty, item);
            parts.push(this._offerText(t, lang, item, sub, qty));
          } else {
            parts.push(t.outOfStockNone(name));
          }
        } else if (qty > item.stock) {
          this.logSignal(item, qty, lang);
          const available = item.stock; // capture before the shelf depletes
          addToCart(this.cart, item, available);
          this._decrementStock(item, available);
          this.lastAdded = { item, qty: available, unit: item.unit };
          parts.push(t.partial(name, qtyText(available, item.unit, lang), qtyText(qty, item.unit, lang)));
        } else {
          addToCart(this.cart, item, qty);
          this._decrementStock(item, qty);
          this.lastAdded = { item, qty, unit: item.unit };
          const line = formatINR(item.price * qty);
          parts.push(this._pickAdded(t)(name, qtyText(qty, item.unit, lang), line, formatINR(this.total)));
        }
      }
      return { ...base, reply: parts.join(' '), lines: this.lines, total: this.total, suggestion: this.pendingSuggestion };
    }

    // Unclear turn: ask once, then offer the typed box instead of repeating
    // the same "I did not catch that" forever.
    this.unknownStreak += 1;
    const reply = this.unknownStreak >= 2 ? t.unknownRepeat : t.unknown;
    return { ...base, reply };
  }
}
