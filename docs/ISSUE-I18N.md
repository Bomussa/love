# ISSUE-I18N.md — تحليل مشكلة الترجمة (i18n)
> تاريخ التحليل: 2026-02-22 | الملف المصدر: `frontend/src/lib/i18n.js`

---

## 1. تأكيد وجود Fallback

لم يتم العثور على آلية fallback صريحة في `frontend/src/lib/i18n.js` تقوم بإرجاع قيمة اللغة العربية (AR) إذا كان مفتاح اللغة الإنجليزية (EN) ناقصًا. الدالة `t` (المستوردة من `i18n.js`) تستخدم كائن `translations` مباشرة. إذا كان المفتاح غير موجود في اللغة المطلوبة، فإنها ستعيد المفتاح نفسه أو قيمة فارغة، وليس ترجمة اللغة الأخرى تلقائيًا.

```javascript
// مثال من استخدام الدالة t في LoginPage.jsx
// t(\'welcome\', language)
// إذا كان المفتاح \'welcome\' غير موجود في اللغة المختارة، فإن الدالة t ستعيد \'welcome\' أو قيمة افتراضية أخرى، وليس ترجمة اللغة العربية.
```

## 2. تحديد المفاتيح المفقودة

تم إجراء تحليل لمقارنة المفاتيح بين كائني الترجمة `ar` و `en` في ملف `frontend/src/lib/i18n.js`.

-   **إجمالي المفاتيح في اللغة العربية (ar):** 126
-   **إجمالي المفاتيح في اللغة الإنجليزية (en):** 270

### المفاتيح الموجودة في اللغة العربية (AR) ومفقودة في اللغة الإنجليزية (EN):

**لا توجد مفاتيح مفقودة.** جميع المفاتيح الموجودة في كائن الترجمة `ar` موجودة أيضًا في كائن الترجمة `en`.

### المفاتيح الموجودة في اللغة الإنجليزية (EN) ومفقودة في اللغة العربية (AR):

فيما يلي قائمة بجميع المفاتيح الموجودة في كائن الترجمة `en` ولكنها مفقودة في كائن `ar`:

```
yourTurnNow
goImmediately
dontBeLate
youAreNext
getReady
onlyOnePerson
estimatedWait
yourTurnIsNear
peopleAhead
notice
information
youMayWaitNear
welcomeToMedicalCommittee
howToUse
followNotifications
watchYourNumber
alertWhenNear
goWhenYourTurn
queueSystemExplained
yourQueueInfo
yourPosition
beingServedNow
allExamsCompleted
congratulations
nextStep
goToReception
toReceive
direction
groundFloorMainEntrance
firstClinicLocation
moveToNewFloor
nextClinic
clinic
room
goToElevator
pressButton
estimatedTime
back
administration
radiology
biometrics
waitForYourTurn
entryNotAvailable
yourNumberIs
currentlyServing
personsAhead
autoRepairSystem
tableNeedsReview
autoRepairFailed
autoRepairSuccess
connectionRestored
connectionLost
retrying
lastUpdate
queuePosition
estimatedWaitTime
clinicStatus
open
closed
paused
serving
called
skipped
postponed
cancelled
noShow
transferredTo
completedAt
enteredAt
calledAt
waitTime
serviceTime
totalTime
averageTime
peakHours
quietHours
dailyReport
weeklyReport
monthlyReport
exportToPDF
exportToExcel
printReport
selectDateRange
from
to
apply
reset
noResultsFound
tryDifferentSearch
clearFilters
showAll
showActive
showCompleted
sortBy
ascending
descending
newest
oldest
systemHealth
allSystemsOperational
someIssuesDetected
criticalIssues
monitoring
startMonitoring
stopMonitoring
refreshData
autoRefresh
every30Seconds
every1Minute
every5Minutes
manual
notifications
enableNotifications
disableNotifications
soundAlerts
vibration
pushNotifications
emailAlerts
smsAlerts
language
arabic
english
theme
darkMode
lightMode
systemDefault
fontSize
small
medium
large
accessibility
highContrast
reducedMotion
screenReader
help
support
contactUs
faq
userGuide
about
version
copyright
privacyPolicy
termsOfService
```

## 3. استنتاج

-   لا يوجد fallback صريح في `i18n.js` لإرجاع ترجمة AR إذا كانت ترجمة EN مفقودة. يجب معالجة هذا لضمان تجربة مستخدم متسقة.
-   بناءً على التعليمات في `B4`، لا توجد مفاتيح في `ar` مفقودة في `en`. هذا يعني أن اللغة الإنجليزية تغطي جميع المفاتيح العربية.
-   ومع ذلك، هناك عدد كبير من المفاتيح في `en` غير موجودة في `ar`. هذا يشير إلى أن الترجمة العربية غير مكتملة وتحتاج إلى استكمال لتشمل جميع المفاتيح الموجودة في اللغة الإنجليزية، لضمان التكافؤ بين اللغتين كما هو مطلوب ضمنياً في `C5`.
