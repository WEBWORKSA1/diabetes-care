# 04. Policy Templates

Eight written policies are the minimum for a HIPAA-covered entity. Below is a scaffold for each. **These are starting templates, not legal documents.** Have your HIPAA support service or attorney review before adopting.

---

## 04a. Privacy Policy (HIPAA Privacy Rule)

**Effective date:** _to fill_
**Owner:** Privacy Officer (Web)
**Review cycle:** Annual

### 1. Purpose
Defines how diabetes.care ("the Practice") collects, uses, and discloses Protected Health Information (PHI) in compliance with 45 CFR 160 and 164 Subparts A and E.

### 2. Scope
Applies to all PHI processed by the Practice's electronic health record system, regardless of medium.

### 3. Uses and disclosures
- **Permitted:** Treatment, Payment, Healthcare Operations (TPO).
- **Required:** Patient access (45 CFR 164.524), accounting of disclosures.
- **Prohibited without authorization:** Marketing, sale of PHI, psychotherapy notes disclosure.

### 4. Patient rights
- Right to access (within 30 days of request).
- Right to amendment.
- Right to accounting of disclosures.
- Right to request restrictions.
- Right to confidential communications.
- Right to file complaints (with the Practice or with HHS OCR).

### 5. Workforce responsibilities
Minimum necessary standard applies. All staff complete training annually.

### 6. Notice of Privacy Practices (NPP)
Provided to all new patients at first encounter. Posted in waiting area and on practice website.

---

## 04b. Security Policy (HIPAA Security Rule)

**Effective date:** _to fill_
**Owner:** Security Officer (Web)
**Review cycle:** Annual

### 1. Administrative safeguards
- Designated Security Officer.
- Workforce clearance procedure (background check on hire for non-solo orgs).
- Information access management based on role.
- Annual security awareness training.
- Incident response procedure (see breach notification policy).
- Contingency plan including backup and disaster recovery.

### 2. Physical safeguards
- Facility access: N/A for cloud-only SaaS.
- Workstation security: full-disk encryption, screen lock <5 min idle, no PHI on local disk.
- Device disposal: secure wipe before reuse or destruction.

### 3. Technical safeguards
- Access control: unique user IDs, automatic logoff, encryption.
- Audit controls: immutable audit log of all PHI access.
- Integrity controls: soft-delete only, no hard deletes of clinical data.
- Transmission security: TLS 1.2+ everywhere, no PHI in URLs.

### 4. Organizational requirements
- BAAs with every business associate.
- Annual review of BAAs.

---

## 04c. Breach Notification Policy

See `06-breach-notification-protocol.md` for the full operational version. Key obligations:

- **Discovery to internal notification:** within 24 hours.
- **Notification of affected individuals:** within 60 days of discovery.
- **Notification to HHS:**
  - >500 individuals: within 60 days.
  - <500 individuals: in annual report by end of next calendar year.
- **Media notification:** required if breach affects >500 in a state/jurisdiction.

---

## 04d. Access Control + Termination Policy

### 1. Granting access
- Access granted on the principle of minimum necessary.
- Roles: `owner`, `provider`, `staff`, `billing` (defined in `users.role`).
- New user creation requires Privacy Officer approval.

### 2. Modifying access
- Role changes require Privacy Officer approval and are logged.

### 3. Termination
- On termination (employment or contractor end):
  1. Disable Supabase Auth user within 24 hours.
  2. Revoke any active sessions.
  3. Rotate any shared credentials (API keys, service role).
  4. Document termination date and steps taken in `audit_log`.

### 4. Quarterly access review
Privacy Officer reviews list of active users and their roles. Document review date.

---

## 04e. Audit and Monitoring Policy

### 1. What gets logged
Every read or write of PHI is captured in `audit_log` with: user ID, action, resource type, resource ID, patient ID, timestamp, IP.

### 2. Review schedule
- **Monthly:** sample 10 audit entries; verify access was appropriate.
- **On-demand:** triggered by patient complaint, suspected breach, or workforce concern.

### 3. Retention
Audit logs retained for minimum 6 years per HIPAA Security Rule.

### 4. Anomaly indicators
- Same user accessing >50 unique patient records in one day.
- Access outside normal business hours without documented reason.
- Bulk export operations.
- Failed login attempts >5 per user per hour.

---

## 04f. Workforce Training Policy

See `05-workforce-training.md` for outline. Frequency: at hire + annually thereafter. Documented sign-off required.

---

## 04g. Contingency / Disaster Recovery Policy

### 1. Data backup
- Supabase Point-in-Time Recovery (PITR) enabled on Team plan.
- Backups retained 14 days (Team default).
- Quarterly: verify restore by creating test branch from backup.

### 2. Disaster recovery
- **RTO** (Recovery Time Objective): 4 hours.
- **RPO** (Recovery Point Objective): 1 hour.
- Restore procedure documented and tested annually.

### 3. Emergency mode operations
If the app is unavailable >4 hours: providers fall back to paper documentation following normal medical record protocols. PHI on paper is locked when not in use; transcribed into the system within 72 hours.

---

## 04h. Sanction Policy

Workforce members (including the founder) who violate this policy will be subject to:

1. **Verbal warning** for first minor offense (e.g. screen lock not used).
2. **Written warning + retraining** for repeat or moderate offenses.
3. **Suspension** for accessing PHI without authorization.
4. **Termination + reporting to licensing board** for malicious or repeated unauthorized access.

For solo founder: self-sanction documented in writing; for incorporated practices: HR-style record retained.
