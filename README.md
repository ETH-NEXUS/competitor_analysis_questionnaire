# Hospital IT Solution Vendor Questionnaire

An English-language questionnaire for comparing hospital IT solutions and their
capabilities. Respondents complete the questionnaire; administrators review the
submissions, compare solutions and track vendor outreach.

## General concept

- **One response per solution/product.** Companies with several distinct solutions
  submit them separately. One solution may belong to several categories.
- **Required information:** respondent email, company/provider, solution name and
  at least one solution category. The respondent's name is optional.
- **Question flow:** respondent details → core questions → relevant
  solution-specific questions → review and submit or share with a colleague.
- **Conditional questions:** categories and earlier answers determine which
  questions and follow-ups appear. For example, record-export questions depend
  on patient-data retention, and documentation-burden questions appear when
  clinical documentation is reported. Hidden answers are excluded from submission.
- **Partial responses are accepted.** Unanswered or incomplete questions are
  highlighted during review, but do not prevent submission.

| Category | Solution type |
| --- | --- |
| A | Hospital-wide clinical information system (CIS) |
| B | Specialized clinical solution / module |
| C | Data / interoperability solution |
| D | Patient-facing solution |

**Question catalogue:**
[Hospital_IT_Vendor_Questionnaire_Questions.docx](Hospital_IT_Vendor_Questionnaire_Questions.docx)
contains the latest questions, answer options and display rules. Its **“Shown when”**
notes explain dependencies on categories and previous answers. It is the
human-readable reference for reviewing the questionnaire.

## Supported workflows and extras

| Workflow | What is included |
| --- | --- |
| Save and resume | Answers save automatically in the browser and are restored after a refresh. |
| Continue with a colleague | **Send to a colleague**, beside **Submit response** on the review page, copies a private link. The colleague sees the existing answers and can continue without an account. The respondent sends the link themselves; no email is sent automatically. |
| Collaborate on one draft | Shared changes save automatically. Simultaneous edits are checked for conflicts so newer work is not silently overwritten. Links expire after 90 days; anyone with the link can view and edit that draft. |
| Review and submit | Unanswered questions are highlighted and question titles link back to their fields. Submission saves the response, even with incomplete questionnaire answers. |
| Keep a response copy | PDF and JSON downloads are available during review and after submission. Downloading a copy does not submit the response. |
| Describe several offerings | A response can include a core CIS platform, external integrations and specialized functions, with company/product names, functional areas, specialties and workflow-integration details. |
| Provide additional detail | Follow-ups cover FHIR releases, HL7 v2 messages, testing events, certification scope/validity, integration requirements and charging bases. “Other” accepts separate entries; single-choice questions accept one. |
| Send answers outside the website | An administrator can import a questionnaire PDF and incorporate answers received separately before saving it to analysis. |

Shared drafts appear in analysis only after submission. Submitting locks the shared
draft; its link then opens a read-only receipt with PDF/JSON downloads.

## Administration

Sign in at `/admin/`. The analysis dashboard is at `/admin/analysis/` and is
restricted to active superusers. Respondents do not need an account.

| Area | What it covers |
| --- | --- |
| Presentation figures | Vendor-level counts, percentages, missing answers and source questions for the assessment slides. |
| Vendor outreach | Vendor names, categories, contact emails, invitations, reminders and declines. Emails appear beneath vendor names. Marking an invitation as sent asks who sent it and records the date/time; both can be changed in **Edit details**. |
| Product comparison | Compare reported offerings by functional area, specialty and workflow integration. Group differently written names for the same product. |
| Question tables | View answer distributions and provider-by-feature comparisons. Q1 uses an access scale; additional “Other” answers can be grouped or assigned to a category. |
| Provider answers | Read the questions and answers for individual providers and solutions. |
| Submissions | View responses from every questionnaire version, download imported original PDFs and delete selected submissions after confirmation. The Django admin table also provides submission filters. |
| PDF import and corrections | Preview a vendor's questionnaire PDF, check identity and categories, then select any questions to add or correct from separate replies. Several corrections can be saved together; the original PDF is retained. **Keep original answer** removes a correction. |
| CSV export | Download the filtered response data, with one row per submission. |

**Analysis logic**

- Detailed analysis and CSV use current-version responses, with provider/category
  filters and an optional latest-response-per-provider view. Older responses
  remain available under **Submissions**.
- Presentation figures count distinct vendors and use all current-version
  responses, independently of detailed-analysis filters. Participation figures
  use vendors marked as invited.
- A submission matches an outreach vendor through its company/provider name or
  an alternate matching name entered in the vendor's details. Unmatched
  submissions are shown for manual linking.
- Unanswered questions and questions not asked are distinguished. Missing answers
  are not interpreted as “No”. Grouping product names or “Other” answers preserves
  the original wording.
- PDF corrections replace only the edited questions in the imported response.
  Opening an editor without changing it preserves the original answer.
  Duplicate PDFs and copies belonging to an existing saved response are rejected.

## Practical guides and learnings

### Change the admin password

Run from the project directory:

```bash
docker compose exec api python manage.py changepassword admin
```

Replace `admin` with your actual administrator username if different and enter
the new password at the prompts. It takes effect immediately; no Docker restart
is needed.

`DJANGO_SU_NAME`, `DJANGO_SU_EMAIL` and `DJANGO_SU_PASSWORD` in `.env` are used
to create the initial account. Changing them does not update an existing account's
password.

### Import a PDF with answers received separately

1. Open **Upload questionnaire PDF** on the analysis page and select **Preview PDF**.
2. Review the recovered details, categories and answers.
3. Open **Add or correct answers from a separate reply**, choose a question and
   select **Edit selected question**. Repeat for other questions if needed.
4. Check the revised answers, then select **Import response**.

Make corrections before importing: uploading the same PDF afterwards is rejected
as a duplicate. PDFs downloaded from the questionnaire are supported; older
copies are recovered from text where possible. Check any preview warnings.
Scanned PDFs and unrecognized question wording cannot be imported safely.

### Resolve conflicting shared edits

Download your current answers first if you need to keep your changes. Load the
latest shared copy, then reapply the changes you want to keep. Unsaved work is
retained in the browser if saving fails.

### Keep the question catalogue consistent

Keep the Word question catalogue and the live questionnaire aligned when changing
questions, choices or dependencies. Editing the DOCX alone does not change the
website. Existing choice order and historical answers need to be considered when
updating the form.

### Find settings and local access

[.env.TEMPLATE](.env.TEMPLATE) lists the configuration settings. Keep an existing
`.env`; host addresses and ports depend on that configuration. With the local
settings used for this project:

- Questionnaire: http://localhost:4080/
- Admin: http://localhost:4000/admin/
- Analysis: http://localhost:4000/admin/analysis/
