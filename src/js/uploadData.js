// ---------------------------------------------------------------------------------------------------------------------
// FUNCTION FOR DOWNLOADING DATA LOCALLY; WITH BLOB
// ---------------------------------------------------------------------------------------------------------------------
// target objects for trials that should be included in the analysis
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

export async function uploadData(safe, ID){
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

  // Prepare form data to send the CSV data as a file
  const formData = new FormData();
  formData.append(
    'csvFile',
    new Blob([csvContent], { type: 'text/csv' }),
    `gdp-prabat-${ID}-${day}-${time}.csv`,
  );
 
  // Send the data to the server
  fetch('./data/data.php', {
    method: 'POST',
    body: formData,
  })
    .then((response) => response.text())
    .then((result) => {
      console.log('Success:', result);
    })
    .catch((error) => {
      console.error('Error:', error);
    });
};
