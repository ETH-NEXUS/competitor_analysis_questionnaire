"""Generate a styled, downloadable copy of the current questionnaire response."""

from io import BytesIO
import json
from pathlib import Path
from xml.sax.saxutils import escape

from django.http import HttpResponse
from django.utils import timezone
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny


INK = colors.HexColor("#173331")
TEAL = colors.HexColor("#007d76")
MUTED = colors.HexColor("#526965")
PALE = colors.HexColor("#edf6f3")
BORDER = colors.HexColor("#dce5e4")
WHITE = colors.white
MAX_SECTIONS = 30
MAX_QUESTIONS_PER_SECTION = 100
MAX_ANSWER_LINES = 1000
MAX_REQUEST_BYTES = 2_000_000


def register_fonts():
    font_root = Path("/usr/share/fonts/truetype/dejavu")
    if "QuestionnaireSans" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("QuestionnaireSans", str(font_root / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(
            TTFont("QuestionnaireSans-Bold", str(font_root / "DejaVuSans-Bold.ttf"))
        )
        pdfmetrics.registerFontFamily(
            "QuestionnaireSans", normal="QuestionnaireSans", bold="QuestionnaireSans-Bold"
        )


def clean_text(value, limit=20000):
    return str(value if value is not None else "").strip()[:limit]


def paragraph_text(value):
    return escape(clean_text(value)).replace("\n", "<br/>")


def pdf_styles():
    return {
        "eyebrow": ParagraphStyle(
            "Eyebrow",
            fontName="QuestionnaireSans-Bold",
            fontSize=8,
            leading=12,
            textColor=TEAL,
            spaceAfter=9,
            tracking=1.2,
        ),
        "title": ParagraphStyle(
            "Title",
            fontName="QuestionnaireSans-Bold",
            fontSize=24,
            leading=31,
            textColor=INK,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            fontName="QuestionnaireSans",
            fontSize=9,
            leading=15,
            textColor=MUTED,
            spaceAfter=20,
        ),
        "section": ParagraphStyle(
            "Section",
            fontName="QuestionnaireSans-Bold",
            fontSize=13,
            leading=19,
            textColor=INK,
            spaceBefore=19,
            spaceAfter=12,
            keepWithNext=True,
        ),
        "question": ParagraphStyle(
            "Question",
            fontName="QuestionnaireSans-Bold",
            fontSize=9.5,
            leading=15,
            textColor=INK,
            spaceAfter=7,
            keepWithNext=True,
        ),
        "answer": ParagraphStyle(
            "Answer",
            fontName="QuestionnaireSans",
            fontSize=8.6,
            leading=14,
            textColor=INK,
            leftIndent=12,
            firstLineIndent=-7,
            spaceAfter=4,
            splitLongWords=True,
            alignment=TA_LEFT,
        ),
        "muted": ParagraphStyle(
            "Muted",
            fontName="QuestionnaireSans",
            fontSize=8.5,
            leading=13,
            textColor=MUTED,
            leftIndent=12,
            spaceAfter=5,
        ),
        "card_label": ParagraphStyle(
            "CardLabel",
            fontName="QuestionnaireSans-Bold",
            fontSize=8,
            leading=12,
            textColor=MUTED,
        ),
        "card_value": ParagraphStyle(
            "CardValue",
            fontName="QuestionnaireSans",
            fontSize=8.7,
            leading=13,
            textColor=INK,
        ),
    }


def response_summary(payload, styles):
    identity = payload.get("respondent") if isinstance(payload.get("respondent"), dict) else {}
    provider = clean_text(identity.get("providerName"), 200) or "Provider not specified"
    solution = clean_text(identity.get("solutionName"), 200) or "Not specified"
    name = clean_text(identity.get("respondentName"), 200) or "Not specified"
    email = clean_text(identity.get("respondentEmail"), 254) or "Not specified"
    scopes = payload.get("scopes") if isinstance(payload.get("scopes"), list) else []
    scope_labels = [
        clean_text(scope.get("label"), 200) for scope in scopes[:5] if isinstance(scope, dict)
    ]
    status = "Submitted response" if payload.get("responseReference") else "Response preview"

    summary_rows = [
        ("COMPANY / PROVIDER", provider),
        ("SOLUTION", solution),
        ("RESPONDENT", name),
        ("EMAIL", email),
        ("SOLUTION SCOPE", ", ".join(scope_labels) or "Not specified"),
    ]
    if payload.get("responseReference"):
        summary_rows.append(("RESPONSE REFERENCE", clean_text(payload["responseReference"], 40)))
    card = Table(
        [
            [
                Paragraph(label, styles["card_label"]),
                Paragraph(paragraph_text(value), styles["card_value"]),
            ]
            for label, value in summary_rows
        ],
        colWidths=[45 * mm, 120 * mm],
        hAlign="LEFT",
    )
    card.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (0, -1), 13),
                ("RIGHTPADDING", (-1, 0), (-1, -1), 13),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, -2), 0.4, BORDER),
            ]
        )
    )
    return provider, status, card


def page_decoration(status):
    width, height = A4

    def decorate(canvas, document):
        canvas.saveState()
        canvas.setFillColor(WHITE)
        canvas.rect(0, 0, width, height, stroke=0, fill=1)
        canvas.setFillColor(TEAL)
        canvas.rect(0, height - 7 * mm, width, 7 * mm, stroke=0, fill=1)
        canvas.setFont("QuestionnaireSans-Bold", 7.5)
        canvas.setFillColor(INK)
        canvas.drawString(20 * mm, height - 17 * mm, "HOSPITAL IT  /  VENDOR QUESTIONNAIRE")
        canvas.setStrokeColor(BORDER)
        canvas.line(20 * mm, height - 21 * mm, width - 20 * mm, height - 21 * mm)
        canvas.line(20 * mm, 16 * mm, width - 20 * mm, 16 * mm)
        canvas.setFont("QuestionnaireSans", 7.5)
        canvas.setFillColor(MUTED)
        canvas.drawString(20 * mm, 11 * mm, status)
        canvas.drawRightString(width - 20 * mm, 11 * mm, f"Page {document.page}")
        canvas.restoreState()

    return decorate


def append_sections(story, sections, styles):
    for section in sections:
        if not isinstance(section, dict):
            continue
        questions = section.get("questions")
        if not isinstance(questions, list) or len(questions) > MAX_QUESTIONS_PER_SECTION:
            raise ValueError("A section has an invalid question list.")
        story.append(Paragraph(paragraph_text(section.get("title")), styles["section"]))
        for question in questions:
            if not isinstance(question, dict):
                continue
            question_id = clean_text(question.get("number") or question.get("id"), 30)
            label = paragraph_text(question.get("question"))
            lines = question.get("readableAnswer")
            if not isinstance(lines, list) or len(lines) > MAX_ANSWER_LINES:
                raise ValueError("A question has too many answers.")
            heading = Paragraph(
                f"<font color='#007d76'>Q{escape(question_id)}</font>  {label}", styles["question"]
            )
            story.append(heading)
            if not lines:
                story.append(Paragraph("Not answered", styles["muted"]))
            else:
                story.extend(
                    Paragraph("•  " + paragraph_text(line), styles["answer"]) for line in lines
                )
            story.append(Spacer(1, 5 * mm))


def make_pdf(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get("sections"), list):
        raise TypeError("A questionnaire response is required.")
    if len(payload["sections"]) > MAX_SECTIONS:
        raise ValueError("The response has too many sections.")
    register_fonts()
    styles = pdf_styles()
    provider, status, card = response_summary(payload, styles)
    stream = BytesIO()
    doc = SimpleDocTemplate(
        stream,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=31 * mm,
        bottomMargin=21 * mm,
        title="Hospital IT Vendor Questionnaire - " + provider,
        author="Hospital IT Vendor Questionnaire",
    )
    story = [
        Paragraph("RESPONSE COPY", styles["eyebrow"]),
        Paragraph("Hospital IT Vendor<br/>Questionnaire", styles["title"]),
        Paragraph(f"{status}  ·  {timezone.localtime().strftime('%d %B %Y')}", styles["subtitle"]),
        card,
        Spacer(1, 9 * mm),
        HRFlowable(width="100%", thickness=1, color=BORDER),
    ]
    append_sections(story, payload["sections"], styles)
    decorate = page_decoration(status)
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    # Keep the original answer structure alongside the readable copy for admin imports.
    writer = PdfWriter(clone_from=PdfReader(BytesIO(stream.getvalue())))
    writer.add_attachment("questionnaire-response.json", json.dumps(payload, ensure_ascii=False).encode())
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


@api_view(["POST"])
@permission_classes([AllowAny])
def export_questionnaire_pdf(request):
    if len(request.body) > MAX_REQUEST_BYTES:
        raise ValidationError("The response is too large to export.")
    try:
        content = make_pdf(request.data)
    except (TypeError, ValueError) as error:
        raise ValidationError(str(error)) from error
    response = HttpResponse(content, content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename="hospital-it-questionnaire.pdf"'
    response["Cache-Control"] = "no-store"
    return response
