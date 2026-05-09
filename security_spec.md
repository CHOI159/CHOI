# Security Specification for No-Show Tracker

## 1. Data Invariants
- A user can only create an activity if they are authenticated.
- A user can only join an activity if it is active.
- Only the creator can cancel an activity.
- A participant can only update their own status.
- Once a status is "no-show", it cannot be changed back by the user (strict locking).
- Users cannot modify their own `noShowCount` in the `users` collection directly (must be done via a transaction or specific logic, but since we are client-side only, we will enforce restricted updates).

## 2. The Dirty Dozen Payloads
1. Attempt to create an activity for another user.
2. Attempt to cancel an activity created by someone else.
3. Attempt to join an activity that is "cancelled".
4. Attempt to update another participant's status.
5. Attempt to increment own `noShowCount` manually.
6. Attempt to set `status` to "arrived" when far away (client-side logic can be bypassed, but rules should restrict who can write).
7. Attempt to delete an activity instead of cancelling.
8. Attempt to inject 1MB of garbage into the activity description.
9. Attempt to create a participant with an invalid ID.
10. Attempt to update `startTime` of an activity after it has passed.
11. Attempt to join an activity without being authenticated.
12. Attempt to read PII of users not associated with any common activity.

## 3. Test Runner (Conceptual)
All the above payloads will be tested against the security rules to ensure they return PERMISSION_DENIED.
