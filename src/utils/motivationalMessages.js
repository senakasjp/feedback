/**
 * Motivational Messages Utility
 * Provides encouraging messages for various actions in the feedback app
 */

// Array of meaningful messages for assignment saving
const assignmentSaveMessages = [
	"ℹ️ Assignment data saved - paragraphs and categories preserved",
	"ℹ️ Assignment saved - all feedback content secured",
	"ℹ️ Assignment stored - ready for student evaluations",
	"ℹ️ Assignment data saved - knowledge areas organized",
	"ℹ️ Assignment saved - categories and marks preserved",
	"ℹ️ Assignment secured - all content backed up",
	"ℹ️ Assignment data saved - ready for student selection",
	"ℹ️ Assignment preserved - feedback structure maintained",
	"ℹ️ Assignment saved - all paragraphs and settings stored",
	"ℹ️ Assignment data secured - evaluation ready",
	"ℹ️ Assignment saved - categories and knowledge areas intact",
	"ℹ️ Assignment stored - feedback framework preserved",
	"ℹ️ Assignment data saved - student evaluation setup complete",
	"ℹ️ Assignment secured - all content and structure saved",
	"ℹ️ Assignment saved - ready for student assessment"
];

// Array of meaningful messages for student evaluation saving
const studentEvaluationMessages = [
	"ℹ️ Student evaluation saved - selections and marks recorded",
	"ℹ️ Student data secured - paragraph selections preserved",
	"ℹ️ Student progress saved - category marks and feedback stored",
	"ℹ️ Student evaluation preserved - all assessment data backed up",
	"ℹ️ Student data saved - selections and category marks recorded",
	"ℹ️ Student assessment secured - feedback and marks preserved",
	"ℹ️ Student evaluation stored - paragraph selections and marks saved",
	"ℹ️ Student data saved - assessment progress recorded",
	"ℹ️ Student evaluation preserved - selections and category marks stored",
	"ℹ️ Student assessment saved - all evaluation data secured",
	"ℹ️ Student data recorded - paragraph selections and marks preserved",
	"ℹ️ Student evaluation saved - assessment progress backed up",
	"ℹ️ Student data secured - selections and feedback stored",
	"ℹ️ Student assessment preserved - all evaluation data saved",
	"ℹ️ Student evaluation stored - selections and marks recorded"
];

/**
 * Get a random motivational message for assignment saving
 * @returns {string} A random motivational message
 */
export function getAssignmentSaveMessage() {
	const randomIndex = Math.floor(Math.random() * assignmentSaveMessages.length);
	return assignmentSaveMessages[randomIndex];
}

/**
 * Get a random motivational message for student evaluation saving
 * @returns {string} A random motivational message
 */
export function getStudentEvaluationMessage() {
	const randomIndex = Math.floor(Math.random() * studentEvaluationMessages.length);
	return studentEvaluationMessages[randomIndex];
}

/**
 * Get a motivational message based on the type of save operation
 * @param {string} saveType - The type of save operation ('assignment' or 'student')
 * @returns {string} A motivational message appropriate for the save type
 */
export function getMotivationalMessage(saveType) {
	switch (saveType) {
		case 'assignment':
			return getAssignmentSaveMessage();
		case 'student':
			return getStudentEvaluationMessage();
		default:
			return "ℹ️ Data saved - all information preserved";
	}
}
