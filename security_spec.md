# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Test Ownership Invariant**: A `Test` document at `/tests/{testId}` can only be created, updated, or deleted by an authenticated user whose `request.auth.uid` matches `creatorUid`.
2. **Test Listing Privacy Invariant**: Listing `/tests` is strictly restricted to authenticated instructors querying their own tests (`resource.data.creatorUid == request.auth.uid`). Blanket listing of all tests is forbidden.
3. **Student Link Access Invariant**: Single-document `get` on `/tests/{testId}` is allowed with `isValidId(testId)` so students anywhere in the world can open a shared short test link without signing in.
4. **Single-Attempt Submission Invariant**: A `TestSubmission` document at `/tests/{testId}/submissions/{submissionId}` can only be created if the parent test `/tests/{testId}` exists (`exists(/databases/$(database)/documents/tests/$(testId))`) and the submission document does not already exist (`allow create` only, `allow update: if false`).
5. **Submission Report Privacy Invariant**: Listing `/tests/{testId}/submissions` or deleting a submission is strictly restricted to the authenticated owner of the parent test (`get(/databases/$(database)/documents/tests/$(testId)).data.creatorUid == request.auth.uid`).

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Test Creation**: Attempting to create `/tests/physics-101` with `auth == null` -> `PERMISSION_DENIED`.
2. **Spoofed `creatorUid` on Test Creation**: Authenticated user `uid_A` creates `/tests/physics-101` with `creatorUid: "uid_B"` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Test**: Adding `{ "isVerifiedAdmin": true }` to `/tests/physics-101` -> `PERMISSION_DENIED` via `hasOnly()`.
4. **Blanket Test Listing by Stranger**: Authenticated user `uid_B` attempts `list` on `/tests` without filtering `creatorUid == "uid_B"` -> `PERMISSION_DENIED`.
5. **Unauthorized Test Deletion**: User `uid_B` attempts to delete `/tests/physics-101` owned by `uid_A` -> `PERMISSION_DENIED`.
6. **Immutable `creatorUid`Tampering on Update**: Owner `uid_A` attempts to update `creatorUid` to `uid_B` -> `PERMISSION_DENIED`.
7. **Orphaned Submission Creation**: Creating `/tests/nonexistent-test/submissions/sub_1` where parent test does not exist -> `PERMISSION_DENIED`.
8. **Submission Score Tampering (Update)**: Student attempts to `update` `/tests/physics-101/submissions/sub_1` after creation to change `totalScore` -> `PERMISSION_DENIED` (`allow update: if false`).
9. **Unauthorized Submission Listing**: Unauthenticated user or non-owner `uid_B` attempts to `list` `/tests/physics-101/submissions` -> `PERMISSION_DENIED`.
10. **Unauthorized Submission Deletion**: Unauthenticated user or non-owner `uid_B` attempts to `delete` `/tests/physics-101/submissions/sub_1` -> `PERMISSION_DENIED`.
11. **Oversized String Poisoning**: Creating a submission with a 10,000-character `studentName` -> `PERMISSION_DENIED`.
12. **Invalid Path ID Injection**: Creating a document with special characters or >128 chars in `{testId}` or `{submissionId}` -> `PERMISSION_DENIED`.
