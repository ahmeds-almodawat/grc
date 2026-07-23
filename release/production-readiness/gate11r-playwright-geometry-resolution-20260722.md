# Gate 11R Playwright geometry resolution

The prior RTL sticky-header failure was test geometry drift: the assertion reused a scroller rectangle captured before viewport layout settled, while browser coordinates were rounded at subpixel boundaries.

The test now waits for fonts and animation-frame layout, recaptures the scroller rectangle after resize and scroll, and permits exactly one physical pixel. Product UI, CSS, accessibility, authorization, and modal behavior were not changed. The isolated test and the complete 25-test Patch 83U serial suite passed.
