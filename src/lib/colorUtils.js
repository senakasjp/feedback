/**
 * Color utility functions for progress bars and visual indicators
 * Provides dynamic color spectrum from red (poor) to green (excellent)
 */

/**
 * Get dynamic color based on current mark relative to maximum possible marks
 * @param {number} currentMark - The current mark achieved
 * @param {number} maxMark - The maximum possible mark
 * @returns {string} RGB color string
 */
export function getDynamicColor(currentMark, maxMark) {
    // Handle edge cases
    if (maxMark <= 0) return '#dc3545'; // red for no max marks
    if (currentMark <= 0) return '#dc3545'; // red for no marks
    
    const percentage = (currentMark / maxMark) * 100;
    
    // Red to Green color interpolation with more distinct colors
    if (percentage <= 0) return '#dc3545'; // red
    if (percentage >= 100) return '#198754'; // green
    
    // Use HSL color space for better color transitions
    if (percentage < 33) {
        // Red to Orange (0-33%)
        const ratio = percentage / 33;
        const red = 255;
        const green = Math.round(69 + (165 - 69) * ratio);
        const blue = 0;
        return `rgb(${red}, ${green}, ${blue})`;
    } else if (percentage < 66) {
        // Orange to Yellow (33-66%)
        const ratio = (percentage - 33) / 33;
        const red = 255;
        const green = 165 + Math.round((255 - 165) * ratio);
        const blue = 0;
        return `rgb(${red}, ${green}, ${blue})`;
    } else {
        // Yellow to Green (66-100%)
        const ratio = (percentage - 66) / 34;
        const red = Math.round(255 - (255 - 25) * ratio);
        const green = 255;
        const blue = Math.round(0 + (84 - 0) * ratio);
        return `rgb(${red}, ${green}, ${blue})`;
    }
}

/**
 * Get Bootstrap color class based on percentage
 * @param {number} percentage - Percentage value (0-100)
 * @returns {string} Bootstrap color class
 */
export function getBootstrapColorClass(percentage) {
    if (percentage >= 80) return 'bg-success';
    if (percentage >= 60) return 'bg-primary';
    if (percentage >= 40) return 'bg-warning text-dark';
    if (percentage >= 20) return 'bg-danger';
    return 'bg-secondary';
}

/**
 * Get grade color based on grade letter
 * @param {string} grade - Grade letter (A, B, C, D, E)
 * @returns {string} Bootstrap color class
 */
export function getGradeColor(grade) {
    if (grade.startsWith('A')) return 'bg-success';
    if (grade.startsWith('B')) return 'bg-primary';
    if (grade.startsWith('C')) return 'bg-warning text-dark';
    if (grade.startsWith('D')) return 'bg-danger';
    return 'bg-secondary';
}
