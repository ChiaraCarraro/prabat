// ---------------------------------------------------------------------------------------------------------------------
// FUNCTION FOR DOWNLOADING DATA LOCALLY; WITH BLOB
// ---------------------------------------------------------------------------------------------------------------------
// target objects for trials that should be in the analysis (set analyze column to true)
const ANALYZE_TARGETS = [
  'dog_brown_shoes',
  'black_ball',
  'still_umbrella',
  'novelMutex',
  'balloon',
  'weird_tshirt2',
  'glass_of_water',
  'pear',
  'truck_B',
  'few',
  'normal_bottle',
  'novel_J',
  'plate_apple',
  'novel_G',
  'Gesture_item1_option2',
  'boy_B_withDrawing_NoBack_talking',
  'umbrella',
  'carrot_cake',
  'Gesture_item2_option2',
];

export async function downloadData(safe, ID){
  safe.forEach((item) => {
    item.subjID = ID;
    item.correct = item.targetObject === item.chosenObject;
    item.analyze = ANALYZE_TARGETS.includes(item.targetObject);
  });

  // convert object into CSV string
  const titleKeys = [
    'subjID',
    'trial',
    'targetObject',
    'chosenObject',
    'chosenPosition',
    'chosenCategory',
    'correct',
    'analyze',
    'timestamp',
    'responseTime',
    'repeatCount',
    'browser',
    'OS',
  ];

  const columnNames = [
    'id',
    'trial',
    'targetObject',
    'chosenObject',
    'chosen_position',
    'chosenCategory',
    'correct',
    'analyze',
    'timestamp',
    'responsetime_ms',
    'repeated',
    'browser',
    'OS',
  ];

  const refinedData = [];
  refinedData.push(columnNames);

  // use the keys to create the other rows
  safe.forEach((item) => {
    const row = titleKeys.map((key) => {
      return item[key];
    });
    refinedData.push(row);
  });

  let csvContent = '';
  refinedData.forEach((row) => {
    csvContent += row.join(',') + '\n';
  });

  // save current date & time (note: UTC time!)
  const day = new Date().toISOString().substring(0, 10);
  const time = new Date().toISOString().substring(11, 19);

  // download via blob
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8,' });
  const objUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', objUrl);
  link.setAttribute('download', `gdp-prabat-${ID}-${day}-${time}.csv`);
  link.click();
}
