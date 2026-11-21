// Kirana product catalog — 34 realistic items.
// Every item has a name in all seven languages (Tamil, Telugu, Hindi, Kannada,
// English, Malayalam, Marathi) plus Latin-script aliases so Tanglish /
// Hinglish / typed input also matches.
// price = price per `unit`. stock = units on the shelf (0 = out of stock, used to
// demo substitute suggestions + restock signals).
// Categories drive substitute suggestions: same category, in stock, nearest price.

export const LANGUAGES = {
  ta: { code: 'ta-IN', label: 'தமிழ்', english: 'Tamil' },
  te: { code: 'te-IN', label: 'తెలుగు', english: 'Telugu' },
  hi: { code: 'hi-IN', label: 'हिन्दी', english: 'Hindi' },
  kn: { code: 'kn-IN', label: 'ಕನ್ನಡ', english: 'Kannada' },
  en: { code: 'en-IN', label: 'English', english: 'English' },
  ml: { code: 'ml-IN', label: 'മലയാളം', english: 'Malayalam' },
  mr: { code: 'mr-IN', label: 'मराठी', english: 'Marathi' },
};

export const ITEMS = [
  {
    id: 'atta-aashirvaad', category: 'flour', unit: 'kg', price: 55, stock: 40,
    names: { ta: 'ஆசீர்வாத் ஆட்டா', te: 'ఆశీర్వాద్ గోధుమ పిండి', hi: 'आशीर्वाद आटा', kn: 'ಆಶೀರ್ವಾದ್ ಗೋಧಿ ಹಿಟ್ಟು', en: 'Aashirvaad Atta', ml: 'ആശിർവാദ് ആട്ട', mr: 'आशीर्वाद आटा' },
    aliases: ['aashirvaad atta', 'aashirvad atta', 'atta', 'aata', 'ஆட்டா', 'आटा', 'godhumai maavu', 'godhuma pindi', 'godhi hittu', 'wheat flour', 'ആട്ട', 'aatta', 'aashirvaad aatta', 'आटा', 'aata', 'aashirvaad aata'],
  },
  {
    id: 'rice-ponni', category: 'grains', unit: 'kg', price: 62, stock: 60,
    names: { ta: 'பொன்னி அரிசி', te: 'పొన్ని బియ్యం', hi: 'पोनि चावल', kn: 'ಪೊನ್ನಿ ಅಕ್ಕಿ', en: 'Ponni Rice', ml: 'പൊന്നി അരി', mr: 'पोन्नी तांदूळ' },
    aliases: ['ponni rice', 'ponni arisi', 'ponni biyyam', 'ponni chawal', 'ponni akki', 'rice', 'arisi', 'biyyam', 'chawal', 'akki', 'அரிசி', 'బియ్యం', 'चावल', 'ಅಕ್ಕಿ', 'അരി', 'ponni ari', 'तांदूळ', 'ponni tandul'],
  },
  {
    id: 'rice-basmati', category: 'grains', unit: 'kg', price: 110, stock: 0,
    names: { ta: 'பாஸ்மதி அரிசி', te: 'బాస్మతి బియ్యం', hi: 'बासमती चावल', kn: 'ಬಾಸ್ಮತಿ ಅಕ್ಕಿ', en: 'Basmati Rice', ml: 'ബസ്മതി അരി', mr: 'बासमती तांदूळ' },
    aliases: ['basmati rice', 'basmati arisi', 'basmati biyyam', 'basmati chawal', 'basmati akki', 'ബസ്മതി', 'basmati ari', 'बासमती', 'basmati tandul'],
  },
  {
    id: 'dal-toor', category: 'dal', unit: 'kg', price: 165, stock: 30,
    names: { ta: 'துவரம் பருப்பு', te: 'కందిపప్పు', hi: 'तुअर दाल', kn: 'ತೊಗರಿ ಬೇಳೆ', en: 'Toor Dal', ml: 'തുവര പരിപ്പ്', mr: 'तूर डाळ' },
    aliases: ['toor dal', 'tuar dal', 'thuvaram paruppu', 'kandi pappu', 'togari bele', 'paruppu', 'pappu', 'bele', 'dal', 'பருப்பு', 'పప్పు', 'दाल', 'ಬೇಳೆ', 'തുവര', 'thuvara parippu', 'तूर', 'toor daal'],
  },
  {
    id: 'dal-moong', category: 'dal', unit: 'kg', price: 140, stock: 20,
    names: { ta: 'பாசிப் பருப்பு', te: 'పెసరపప్పు', hi: 'मूंग दाल', kn: 'ಹೆಸರು ಬೇಳೆ', en: 'Moong Dal', ml: 'ചെറുപയർ പരിപ്പ്', mr: 'मूग डाळ' },
    aliases: ['moong dal', 'pasi paruppu', 'pesara pappu', 'hesaru bele', 'ചെറുപയർ', 'cherupayar', 'मूग', 'moong daal'],
  },
  {
    id: 'dal-urad', category: 'dal', unit: 'kg', price: 150, stock: 18,
    names: { ta: 'உளுந்து', te: 'మినపప్పు', hi: 'उड़द दाल', kn: 'ಉದ್ದಿನ ಬೇಳೆ', en: 'Urad Dal', ml: 'ഉഴുന്ന് പരിപ്പ്', mr: 'उडीद डाळ' },
    aliases: ['urad dal', 'ulundhu', 'minapa pappu', 'uddina bele', 'ഉഴുന്ന്', 'uzhunnu', 'उडीद', 'udid daal'],
  },
  {
    id: 'dal-chana', category: 'dal', unit: 'kg', price: 95, stock: 22,
    names: { ta: 'கடலைப் பருப்பு', te: 'శనగపప్పు', hi: 'चना दाल', kn: 'ಕಡಲೆ ಬೇಳೆ', en: 'Chana Dal', ml: 'കടല പരിപ്പ്', mr: 'चना डाळ' },
    aliases: ['chana dal', 'kadalai paruppu', 'shanaga pappu', 'kadale bele', 'കടല', 'kadala', 'चना', 'chana daal'],
  },
  {
    id: 'sugar', category: 'staples', unit: 'kg', price: 45, stock: 50,
    names: { ta: 'சர்க்கரை', te: 'చక్కెర', hi: 'चीनी', kn: 'ಸಕ್ಕರೆ', en: 'Sugar', ml: 'പഞ്ചസാര', mr: 'साखर' },
    aliases: ['sugar', 'sarkkarai', 'chakkera', 'cheeni', 'sakkare', 'പഞ്ചസാര', 'panchasara', 'साखर', 'sakhar'],
  },
  {
    id: 'salt-tata', category: 'staples', unit: 'kg', price: 28, stock: 45,
    names: { ta: 'டாடா உப்பு', te: 'టాటా ఉప్పు', hi: 'टाटा नमक', kn: 'ಟಾಟಾ ಉಪ್ಪು', en: 'Tata Salt', ml: 'ടാറ്റ ഉപ്പ്', mr: 'टाटा मीठ' },
    aliases: ['tata salt', 'tata uppu', 'salt', 'uppu', 'namak', 'ഉപ്പ്', 'uppu', 'मीठ', 'meeth'],
  },
  {
    id: 'oil-sunflower', category: 'oil', unit: 'litre', price: 135, stock: 30,
    names: { ta: 'சூரியகாந்தி எண்ணெய்', te: 'సన్‌ఫ్లవర్ నూనె', hi: 'सूरजमुखी तेल', kn: 'ಸೂರ್ಯಕಾಂತಿ ಎಣ್ಣೆ', en: 'Sunflower Oil', ml: 'സൂര്യകാന്തി എണ്ണ', mr: 'सूर्यफूल तेल' },
    aliases: ['sunflower oil', 'suriyakanthi ennai', 'sunflower noone', 'surajmukhi tel', 'suryakanti enne', 'oil', 'ennai', 'noone', 'tel', 'enne', 'எண்ணெய்', 'నూనె', 'तेल', 'ಎಣ್ಣೆ', 'എണ്ണ', 'suriyakanthi enna', 'तेल', 'suryaphul tel'],
  },
  {
    id: 'oil-groundnut', category: 'oil', unit: 'litre', price: 175, stock: 0,
    names: { ta: 'கடலை எண்ணெய்', te: 'వేరుశనగ నూనె', hi: 'मूंगफली तेल', kn: 'ಕಡಲೆಕಾಯಿ ಎಣ್ಣೆ', en: 'Groundnut Oil', ml: 'കടല എണ്ണ', mr: 'शेंगदाणा तेल' },
    aliases: ['groundnut oil', 'kadalai ennai', 'verusenaga noone', 'moongphali tel', 'kadalekayi enne', 'കടല എണ്ണ', 'kadala enna', 'शेंगदाणा', 'shengdana tel'],
  },
  {
    id: 'ghee', category: 'dairy', unit: 'kg', price: 650, stock: 8,
    names: { ta: 'நெய்', te: 'నెయ్యి', hi: 'घी', kn: 'ತುಪ್ಪ', en: 'Ghee', ml: 'നെയ്യ്', mr: 'तूप' },
    aliases: ['ghee', 'nei', 'neyyi', 'tuppa', 'നെയ്യ്', 'neyyu', 'तूप', 'toop'],
  },
  {
    id: 'milk', category: 'dairy', unit: 'litre', price: 58, stock: 20,
    names: { ta: 'பால்', te: 'పాలు', hi: 'दूध', kn: 'ಹಾಲು', en: 'Milk', ml: 'പാൽ', mr: 'दूध' },
    aliases: ['milk', 'paal', 'paalu', 'doodh', 'haalu', 'പാൽ', 'paal', 'दूध', 'doodh'],
  },
  {
    id: 'curd', category: 'dairy', unit: 'packet', price: 35, stock: 24,
    names: { ta: 'தயிர்', te: 'పెరుగు', hi: 'दही', kn: 'ಮೊಸರು', en: 'Curd', ml: 'തൈര്', mr: 'दही' },
    aliases: ['curd', 'thayir', 'perugu', 'dahi', 'mosaru', 'തൈര്', 'thairu', 'दही', 'dahi'],
  },
  {
    id: 'eggs', category: 'dairy', unit: 'piece', price: 7, stock: 60,
    names: { ta: 'முட்டை', te: 'గుడ్డు', hi: 'अंडा', kn: 'ಮೊಟ್ಟೆ', en: 'Eggs', ml: 'മുട്ട', mr: 'अंडी' },
    aliases: ['eggs', 'egg', 'muttai', 'guddu', 'anda', 'motte', 'മുട്ട', 'mutta', 'अंडी', 'andi'],
  },
  {
    id: 'bread', category: 'bakery', unit: 'packet', price: 45, stock: 12,
    names: { ta: 'ரொட்டி', te: 'బ్రెడ్', hi: 'ब्रेड', kn: 'ಬ್ರೆಡ್', en: 'Milk Bread', ml: 'ബ്രെഡ്', mr: 'ब्रेड' },
    aliases: ['milk bread', 'bread', 'rotti', 'bredu', 'ബ്രെഡ്', 'bredu', 'ब्रेड', 'bread'],
  },
  {
    id: 'tea', category: 'beverages', unit: 'kg', price: 460, stock: 10,
    names: { ta: 'டீ தூள்', te: 'టీ పొడి', hi: 'चाय पत्ती', kn: 'ಚಹಾ ಪುಡಿ', en: 'Tea Powder', ml: 'ചായപ്പൊടി', mr: 'चहा पावडर' },
    aliases: ['tea powder', 'tea', 'thee thool', 'tea podi', 'chai', 'chaha pudi', 'ചായപ്പൊടി', 'chayappodi', 'चहा', 'chaha'],
  },
  {
    id: 'coffee', category: 'beverages', unit: 'kg', price: 560, stock: 0,
    names: { ta: 'காபி தூள்', te: 'కాఫీ పొడి', hi: 'कॉफ़ी पाउडर', kn: 'ಕಾಫಿ ಪುಡಿ', en: 'Coffee Powder', ml: 'കാപ്പിപ്പൊടി', mr: 'कॉफी पावडर' },
    aliases: ['coffee powder', 'coffee', 'kaapi thool', 'coffee podi', 'kaapi pudi', 'കാപ്പിപ്പൊടി', 'kappipodi', 'कॉफी', 'coffee'],
  },
  {
    id: 'turmeric', category: 'spices', unit: 'kg', price: 320, stock: 10,
    names: { ta: 'மஞ்சள் தூள்', te: 'పసుపు', hi: 'हल्दी', kn: 'ಅರಿಶಿನ', en: 'Turmeric Powder', ml: 'മഞ്ഞൾപ്പൊടി', mr: 'हळद' },
    aliases: ['turmeric powder', 'turmeric', 'manjal', 'pasupu', 'haldi', 'arishina', 'മഞ്ഞൾ', 'manjal', 'हळद', 'halad'],
  },
  {
    id: 'chilli-powder', category: 'spices', unit: 'kg', price: 380, stock: 10,
    names: { ta: 'மிளகாய் தூள்', te: 'కారం పొడి', hi: 'मिर्च पाउडर', kn: 'ಮೆಣಸಿನ ಪುಡಿ', en: 'Chilli Powder', ml: 'മുളകുപൊടി', mr: 'मिरची पावडर' },
    aliases: ['chilli powder', 'milagai thool', 'karam podi', 'mirch powder', 'menasina pudi', 'മുളക്', 'mulaku', 'मिरची', 'mirchi'],
  },
  {
    id: 'coriander-powder', category: 'spices', unit: 'kg', price: 340, stock: 10,
    names: { ta: 'மல்லித் தூள்', te: 'ధనియాల పొడి', hi: 'धनिया पाउडर', kn: 'ಕೊತ್ತಂಬರಿ ಪುಡಿ', en: 'Coriander Powder', ml: 'മല്ലിപ്പൊടി', mr: 'धणे पावडर' },
    aliases: ['coriander powder', 'malli thool', 'dhaniyala podi', 'dhaniya powder', 'kottambari pudi', 'മല്ലി', 'malli', 'धणे', 'dhane'],
  },
  {
    id: 'cumin', category: 'spices', unit: 'kg', price: 480, stock: 6,
    names: { ta: 'சீரகம்', te: 'జీలకర్ర', hi: 'जीरा', kn: 'ಜೀರಿಗೆ', en: 'Cumin Seeds', ml: 'ജീരകം', mr: 'जिरे' },
    aliases: ['cumin seeds', 'cumin', 'seeragam', 'jeelakarra', 'jeera', 'jeerige', 'ജീരകം', 'jeerakam', 'जिरे', 'jire'],
  },
  {
    id: 'mustard', category: 'spices', unit: 'kg', price: 180, stock: 8,
    names: { ta: 'கடுகு', te: 'ఆవాలు', hi: 'सरसों', kn: 'ಸಾಸಿವೆ', en: 'Mustard Seeds', ml: 'കടുക്', mr: 'मोहरी' },
    aliases: ['mustard seeds', 'mustard', 'kadugu', 'aavalu', 'sarson', 'sasive', 'കടുക്', 'kaduku', 'मोहरी', 'mohari'],
  },
  {
    id: 'soap', category: 'personal', unit: 'piece', price: 45, stock: 30,
    names: { ta: 'மைசூர் சாண்டல் சோப்', te: 'మైసూర్ శాండల్ సబ్బు', hi: 'मैसूर सैंडल साबुन', kn: 'ಮೈಸೂರು ಸ್ಯಾಂಡಲ್ ಸೋಪು', en: 'Mysore Sandal Soap', ml: 'മൈസൂർ സാൻഡൽ സോപ്പ്', mr: 'म्हैसूर सँडल साबण' },
    aliases: ['mysore sandal soap', 'soap', 'soppu', 'sabbu', 'sabun', 'sopu', 'സോപ്പ്', 'soppu', 'साबण', 'saban'],
  },
  {
    id: 'shampoo', category: 'personal', unit: 'piece', price: 5, stock: 100,
    names: { ta: 'ஷாம்பு', te: 'షాంపూ', hi: 'शैम्पू', kn: 'ಶಾಂಪೂ', en: 'Shampoo Sachet', ml: 'ഷാംപൂ', mr: 'शाम्पू' },
    aliases: ['shampoo sachet', 'shampoo', 'shampu', 'ഷാംപൂ', 'shampoo', 'शाम्पू', 'shampoo'],
  },
  {
    id: 'toothpaste', category: 'personal', unit: 'piece', price: 95, stock: 20,
    names: { ta: 'கோல்கேட் பற்பசை', te: 'కోల్గేట్ టూత్‌పేస్ట్', hi: 'कोलगेट टूथपेस्ट', kn: 'ಕೋಲ್ಗೇಟ್ ಟೂತ್ಪೇಸ್ಟ್', en: 'Colgate Toothpaste', ml: 'കോൾഗേറ്റ് പേസ്റ്റ്', mr: 'कोलगेट टूथपेस्ट' },
    aliases: ['colgate toothpaste', 'toothpaste', 'colgate', 'palpasai', 'tooth paste', 'പേസ്റ്റ്', 'paste', 'टूथपेस्ट', 'toothpaste'],
  },
  {
    id: 'detergent', category: 'home', unit: 'kg', price: 120, stock: 15,
    names: { ta: 'சோப் பவுடர்', te: 'సర్ఫ్ పౌడర్', hi: 'सर्फ पाउडर', kn: 'ಸರ್ಫ್ ಪೌಡರ್', en: 'Detergent Powder', ml: 'സോപ്പുപൊടി', mr: 'डिटर्जंट पावडर' },
    aliases: ['detergent powder', 'detergent', 'surf powder', 'surf', 'soap powder', 'സോപ്പുപൊടി', 'soppupodi', 'डिटर्जंट', 'detergent'],
  },
  {
    id: 'biscuits', category: 'snacks', unit: 'packet', price: 30, stock: 40,
    names: { ta: 'மேரி கோல்டு பிஸ்கட்', te: 'మేరీ గోల్డ్ బిస్కెట్', hi: 'मैरी गोल्ड बिस्कुट', kn: 'ಮೇರಿ ಗೋಲ್ಡ್ ಬಿಸ್ಕತ್ತು', en: 'Marie Gold Biscuits', ml: 'മേരി ഗോൾഡ് ബിസ്കറ്റ്', mr: 'मेरी गोल्ड बिस्किटे' },
    aliases: ['marie gold biscuits', 'marie gold', 'biscuits', 'biscuit', 'biskat', 'bisket', 'biskuttu', 'ബിസ്കറ്റ്', 'biscuit', 'बिस्किटे', 'biskite'],
  },
  {
    id: 'banana', category: 'fresh', unit: 'dozen', price: 60, stock: 24,
    names: { ta: 'வாழைப்பழம்', te: 'అరటిపండు', hi: 'केला', kn: 'ಬಾಳೆಹಣ್ಣು', en: 'Banana', ml: 'വാഴപ്പഴം', mr: 'केळी' },
    aliases: ['banana', 'vazhaipazham', 'aratipandu', 'kela', 'balehannu', 'വാഴപ്പഴം', 'vazhapazham', 'केळी', 'keli'],
  },
  {
    id: 'onion', category: 'fresh', unit: 'kg', price: 40, stock: 50,
    names: { ta: 'வெங்காயம்', te: 'ఉల్లిపాయ', hi: 'प्याज़', kn: 'ಈರುಳ್ಳಿ', en: 'Onion', ml: 'സവാള', mr: 'कांदा' },
    aliases: ['onion', 'vengayam', 'ullipaya', 'pyaaz', 'eerulli', 'സവാള', 'savala', 'कांदा', 'kanda'],
  },
  {
    id: 'tomato', category: 'fresh', unit: 'kg', price: 35, stock: 40,
    names: { ta: 'தக்காளி', te: 'టమాటా', hi: 'टमाटर', kn: 'ಟೊಮೆಟೊ', en: 'Tomato', ml: 'തക്കാളി', mr: 'टोमॅटो' },
    aliases: ['tomato', 'thakkali', 'tamata', 'tamatar', 'tometo', 'തക്കാളി', 'thakkali', 'टोमॅटो', 'tomato'],
  },
  {
    id: 'potato', category: 'fresh', unit: 'kg', price: 38, stock: 45,
    names: { ta: 'உருளைக்கிழங்கு', te: 'బంగాళదుంప', hi: 'आलू', kn: 'ಆಲೂಗಡ್ಡೆ', en: 'Potato', ml: 'ഉരുളക്കിഴങ്ങ്', mr: 'बटाटा' },
    aliases: ['potato', 'urulaikizhangu', 'bangaladumpa', 'aalu', 'aaloogedde', 'ഉരുളക്കിഴങ്ങ്', 'urulakizhangu', 'बटाटा', 'batata'],
  },
  {
    id: 'rava', category: 'flour', unit: 'kg', price: 48, stock: 15,
    names: { ta: 'ரவை', te: 'బొంబాయి రవ్వ', hi: 'सूजी', kn: 'ರವೆ', en: 'Rava (Semolina)', ml: 'റവ', mr: 'रवा' },
    aliases: ['rava', 'semolina', 'ravai', 'bombai ravva', 'sooji', 'rave', 'റവ', 'rava', 'रवा', 'rava'],
  },
  {
    id: 'poha', category: 'grains', unit: 'kg', price: 52, stock: 12,
    names: { ta: 'அவல்', te: 'అటుకులు', hi: 'पोहा', kn: 'ಅವಲಕ್ಕಿ', en: 'Poha (Flattened Rice)', ml: 'അവൽ', mr: 'पोहे' },
    aliases: ['poha', 'flattened rice', 'aval', 'atukulu', 'avalakki', 'അവൽ', 'aval', 'पोहे', 'pohe'],
  },
];

export function getItem(id) {
  return ITEMS.find((i) => i.id === id) || null;
}

export function nameIn(item, lang) {
  return item.names[lang] || item.names.en;
}

// Substitute: same category, in stock, same unit preferred, nearest price.
// Returns null when nothing suitable is on the shelf.
export function findSubstituteIn(item, items) {
  const candidates = (items || []).filter(
    (c) => c.id !== item.id && c.category === item.category && c.stock > 0,
  );
  if (candidates.length === 0) return null;
  const sameUnit = candidates.filter((c) => c.unit === item.unit);
  const pool = sameUnit.length > 0 ? sameUnit : candidates;
  pool.sort((a, b) => Math.abs(a.price - item.price) - Math.abs(b.price - item.price));
  return pool[0];
}

export function findSubstitute(item) {
  return findSubstituteIn(item, ITEMS);
}
