# Mark allocation rules

Category marks must be finite, non-negative and no greater than their effective maximum. Blank means unmarked; zero is a valid mark. AI `Marks: X/Y` suggestions must use the category's exact maximum as Y. Invalid suggestions are rejected without applying a mark.

Mark entry and the Students with Marks summary share `getAssessmentForMarking` in `src/utils/rubricMarks.js`. A valid maximum in the rubric’s last Marks column takes precedence over the configured category allocation, using the saved row-to-category mapping. Categories without a valid rubric maximum retain their configured allocation. Resolution never rewrites stored allocations or student marks.

The assessment maximum is the positive configured total, or the sum of category maxima when no positive total is configured. A configured total that disagrees with the category allocations prevents a final percentage. Existing invalid marks are preserved for correction and flagged, rather than silently clamped. Duplicate category names also prevent completion.

A final percentage requires all categories with a positive allocation (or fixed marking mode) to be marked. Unknown legacy category marks are preserved in stored data but excluded from the current assessment total. Reports distinguish incomplete marking from a final result.

Weighted contribution is `(awarded / assessment maximum) × assessment weight`. Subject percentage divides summed contributions by summed positive assessment weights and multiplies by 100. Missing results for weighted assessments prevent a final subject grade. Numeric weights saved as strings (for example, `"60"`) are parsed before calculation. For assessments out of 100, marks of 80 at 40% and 90 at 60% contribute 32.0 and 54.0, yielding 86.0 overall (A).

Default bands are F below 40%, D from 40%, C from 50%, B from 65%, and A from 80%. Boundaries are lower-inclusive and upper-exclusive, except 100% is included. Legacy integer ranges ending at 39/49/64/79 extend to the next band's boundary, so fractional marks have no accidental gaps. Custom assessment bands are respected; unspecified custom letter grades display the color label rather than an invented letter. Subject results use the shared default scheme.

These rules establish consistent arithmetic. The educational suitability of category weights, institutional grade thresholds, and AI judgement still requires an assessor-approved rubric and comparison against human-marked examples.
