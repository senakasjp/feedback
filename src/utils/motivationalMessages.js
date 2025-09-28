/**
 * Motivational Messages Utility
 * Provides encouraging messages for various actions in the feedback app
 */

// Array of motivational messages for assignment saving
const assignmentSaveMessages = [
	"🌟 Great job! Your assignment data has been saved successfully!",
	"✨ Excellent work! Your progress has been preserved.",
	"🎯 Perfect! Your assignment is now safely stored.",
	"🚀 Fantastic! Your hard work has been saved.",
	"💎 Outstanding! Your assignment data is secure.",
	"⭐ Amazing! Your progress continues to grow.",
	"🔥 Incredible! You're making great progress!",
	"🎨 Beautiful work! Your assignment is saved.",
	"💪 Keep up the excellent work! Data saved.",
	"🌈 Wonderful! Your assignment progress is preserved.",
	"🎪 Spectacular! Your work is safely stored.",
	"🎵 Harmonious! Your assignment data is saved.",
	"🎭 Brilliant! Your progress has been captured.",
	"🎨 Creative work! Your assignment is secure.",
	"🏆 Champion! Your data has been saved successfully!"
];

// Array of motivational messages for student evaluation saving
const studentEvaluationMessages = [
	"🎓 Excellent feedback provided! Student data saved.",
	"📚 Great assessment! Student evaluation is secure.",
	"🎯 Perfect evaluation! Student progress recorded.",
	"⭐ Outstanding feedback! Student data preserved.",
	"🌟 Wonderful assessment! Student evaluation saved.",
	"🚀 Fantastic work! Student progress is secure.",
	"💎 Brilliant evaluation! Student data is safe.",
	"🎨 Beautiful feedback! Student assessment saved.",
	"🔥 Incredible evaluation! Student data preserved.",
	"💪 Great job! Student progress is recorded.",
	"🌈 Excellent assessment! Student evaluation saved.",
	"🎪 Wonderful feedback! Student data is secure.",
	"🎵 Harmonious evaluation! Student progress saved.",
	"🎭 Brilliant work! Student assessment preserved.",
	"🏆 Champion evaluation! Student data is safe!"
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
			return "🌟 Great job! Your data has been saved successfully!";
	}
}
