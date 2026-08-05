/**
 * This is contains constants which are related to the EQ-5D-5L questionnaire.
 * The data is crucial for correctly displaying and interpreting the results of the EQ-5D-5L questionnaire in the PROMs tab.
 */

// Questionnaire identification
export const QUESTIONNAIRE_NAME = 'EQ-5D-5L';
export const PROM_EVENT_TYPE = 'PROMs';
export const SUBTYPE = 'SUBTYPE';

// Dataset keys
export const PROM_KEYS = [
    'MOBILITY',
    'SELF-CARE',
    'USUAL_ACTIVITY',
    'PAIN/DISCOMFORT',
    'ANXIETY/DEPRESSION',
    'AVERAGE',
    'INDEX',
    'VAS',
];

export const AVERAGE_KEY = 'AVERAGE';
export const DATE_KEY = 'DATE_ISO';
export const INDEX_KEY = 'INDEX';
export const VAS_KEY = 'VAS';
export const STANDARD_RANGE_KEY = 'STANDARD_RANGE';
export const REFERENCE_VALUE_KEY = 'STUDY_AVERAGE_INDEX';

// Dimensions
export const VALUES_ALPHA = ['No', 'Slight', 'Moderate', 'Severe', 'Extreme'];
export const VALUES_RANGE: [number, number] = [1, 5];

// EQ and VAS
export const EQ_RANGE: [number, number] = [0, 1]; // due to normalization, negative values can only be displayed as 0
export const EQ_VALUES_ALPHA = [
    '(worst health) 0',
    '0.25',
    '0.5',
    '0.75',
    '(best health) 1',
];
export const VAS_RANGE: [number, number] = [0, 100];
export const VAS_VALUES_ALPHA = [
    '0 (worst health)',
    '25',
    '50',
    '75',
    '100 (best health)',
];

// Standard Range, Thresholds & reference line
export const STANDARD_RANGE: [number, number] = [Infinity, Infinity]; // e.g., [0.4, 0.76]
export const THRESHOLDS_EQ: number[] = []; // e.g., [0.25, 0.5, 0.75], specify between 1 and 4 numbers
export const THRESHOLDS_VAS: number[] = []; // e.g., [30, 60], specify between 1 and 4 numbers
// for line scatter plot
export const SHOW_STANDARD_RANGE = false;
export const SHOW_REFERENCE_LINE = false;
// for pie plot; EQ and VAS thresholds
export const SHOW_THRESHOLDS = false;

// Texts
export const CHART_TITLES = [
    'Current EQ-Score',
    'Scores',
    'Health State Detail',
];
export const EQ_5D_5L_INFO_URL: string =
    'https://euroqol.org/information-and-support/euroqol-instruments/eq-5d-5l/';

export const CURRENT_SCORES_INFO: string = `<p><strong>EQ-5D-5L Most Recent Index and VAS Score</strong></p>
<p>This donut chart displays the patient's most recent Index and VAS scores from the EQ-5D-5L<br />questionnaire, along with the collection date.</p>
<p>The colored portion of each donut represents the score as a percentage of the maximum possible value:
<ul>
<li> <strong>Index:</strong> Maximum value is 1.0 (a fully colored donut = perfect health state) </li>
<li> <strong>VAS:</strong> Maximum value is 100 (a fully colored donut = best imaginable health) </li>
</ul>
</p>
<p>
<strong>Important Notes:</strong>
<ul>
<li>The Index and VAS scores may come from different questionnaire dates if these are the most<br />recent available values for each measure </li>
<li>When scores are from different dates, both dates will be shown </li>
<li>If either score is unavailable, a notification will appear instead of the chart</li>
</ul>
</p>`;

export const SCORES_INFO: string = `<p><strong>EQ-5D-5L Index and VAS Score Over Time</strong></p>
<p>This line chart tracks changes in both the EQ-5D-5L Index and VAS scores across multiple questionnaires,<br />with each data point representing one completed questionnaire.</p>
<p><strong>Chart Layout:</strong>
<ul>
<li><strong>Left axis:</strong> EQ-5D-5L Index values (range: 0 to 1.0) </li>
<li><strong>Right axis:</strong> VAS scores (range: 0 to 100) </li>
<li><strong>Highlighted Values:</strong> Negative Index scores are drawn at the 0 level but visually emphasized as<br /> they indicate health states considered worse than death</li>
<li><strong>Reference Line:</strong> If defined, a reference value calculated from all patients in the current study cohort will be displayed</li>
<li><strong>Reference Range:</strong> If defined, a population-based reference range can be displayed for broader comparison</li>
</ul>
</p>
<p><strong>How to Use the Chart:</strong>
<ul>
<li><strong>Hover</strong> over any data point to see the exact score and date </li>
<li><strong>Click</strong> on Index or VAS in the legend to show/hide that score line </li>
<li><strong>Scroll horizontally</strong> when more than six questionnaires are displayed (charts with six or fewer<br />questionnaires show all data without scrolling) </li>
</ul>
</p>
<p>
<strong>Understanding the Data:</strong>
<ul>
<li>Missing Index or VAS scores are excluded from the chart display </li>
<li>Questionnaires with both missing Index and VAS scores, or invalid dates, are not shown</li>
<li>Each score line uses its respective axis scale for accurate trend visualization</li>
</ul>
</p>
`;

export const HEALTH_DETAILS_INFO: string = `<p><strong>EQ-5D-5L Dimensions Over Time</strong></p>
<p>This line chart tracks changes in the five EQ-5D-5L dimensions across multiple questionnaires, with each <br />data point representing one completed questionnaire. An optional average line can be displayed to show<br />the overall trend.</p>
<p><strong>How to Use the Chart:</strong>
<ul>
<li><strong>Hover</strong> over any data point to see the exact value </li>
<li><strong>Click</strong> on any dimension name in the legend to show/hide that dimension's line </li>
<li><strong>Scroll horizontally</strong> when more than six questionnaires are displayed (charts with six or fewer<br />questionnaires show all data without scrolling) </li>
</ul>
</p>
<p>
<strong>Understanding the Data:</strong>
<ul>
<li>Each dimension is scored from 1 (no problems) to 5 (extreme problems)</li>
<li>The average line represents the mean of all available dimension scores at each time point </li>
<li>Missing dimension scores are excluded from both the chart display and average calculation</li>
<li>Questionnaires with no usable dimension data or invalid dates are not shown</li>
</ul>
</p>
`;
