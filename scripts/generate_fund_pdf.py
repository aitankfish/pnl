#!/usr/bin/env python3
"""Generate PNL Investment Use-of-Funds PDF"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable
)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTPUT_PATH = os.path.join(REPO_ROOT, "docs", "legal", "PNL_Use_of_Funds.pdf")
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

# Colors
DARK_BG = HexColor("#0a0a0a")
ACCENT = HexColor("#6366f1")    # indigo
ACCENT2 = HexColor("#8b5cf6")   # purple
GREEN = HexColor("#22c55e")
LIGHT_GRAY = HexColor("#f3f4f6")
MED_GRAY = HexColor("#9ca3af")
DARK_TEXT = HexColor("#111827")
ROW_ALT = HexColor("#f9fafb")
HEADER_BG = HexColor("#1e1b4b")  # deep indigo
BORDER = HexColor("#e5e7eb")

def build_pdf():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Title"],
        fontSize=28, leading=34, textColor=DARK_TEXT,
        spaceAfter=4, fontName="Helvetica-Bold"
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=12, leading=16, textColor=MED_GRAY,
        spaceAfter=20, fontName="Helvetica"
    )
    h1 = ParagraphStyle(
        "H1", parent=styles["Heading1"],
        fontSize=18, leading=22, textColor=ACCENT,
        spaceBefore=24, spaceAfter=10, fontName="Helvetica-Bold"
    )
    h2 = ParagraphStyle(
        "H2", parent=styles["Heading2"],
        fontSize=14, leading=18, textColor=DARK_TEXT,
        spaceBefore=16, spaceAfter=8, fontName="Helvetica-Bold"
    )
    body = ParagraphStyle(
        "Body", parent=styles["Normal"],
        fontSize=10, leading=14, textColor=DARK_TEXT,
        spaceAfter=6, fontName="Helvetica"
    )
    body_bold = ParagraphStyle(
        "BodyBold", parent=body,
        fontName="Helvetica-Bold"
    )
    small = ParagraphStyle(
        "Small", parent=body,
        fontSize=8.5, leading=11, textColor=MED_GRAY
    )
    center_style = ParagraphStyle(
        "Center", parent=body,
        alignment=TA_CENTER, fontSize=11, leading=15
    )
    quote_style = ParagraphStyle(
        "Quote", parent=body,
        fontSize=11, leading=16, textColor=ACCENT,
        leftIndent=20, rightIndent=20, spaceBefore=10, spaceAfter=10,
        fontName="Helvetica-Oblique"
    )
    footer_style = ParagraphStyle(
        "Footer", parent=body,
        fontSize=8, textColor=MED_GRAY, alignment=TA_CENTER
    )

    elements = []

    # ─── COVER SECTION ───
    elements.append(Spacer(1, 0.8 * inch))
    elements.append(Paragraph("PNL", ParagraphStyle(
        "Logo", parent=title_style, fontSize=42, textColor=ACCENT
    )))
    elements.append(Paragraph("Predict & Launch", subtitle_style))
    elements.append(Spacer(1, 0.2 * inch))
    elements.append(HRFlowable(width="100%", thickness=2, color=ACCENT))
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(Paragraph("Use of Funds &<br/>Investment Breakdown", title_style))
    elements.append(Paragraph("Confidential  |  March 2026  |  Raising $1M at $10M Valuation", subtitle_style))
    elements.append(Spacer(1, 0.4 * inch))

    # Key metrics box
    metrics_data = [
        [Paragraph("<b>Raising</b>", center_style),
         Paragraph("<b>Valuation</b>", center_style),
         Paragraph("<b>Equity</b>", center_style),
         Paragraph("<b>Runway</b>", center_style)],
        [Paragraph("$1,000,000", ParagraphStyle("mc", parent=center_style, fontSize=16, textColor=ACCENT, fontName="Helvetica-Bold")),
         Paragraph("$10,000,000", ParagraphStyle("mc2", parent=center_style, fontSize=16, textColor=ACCENT, fontName="Helvetica-Bold")),
         Paragraph("9.1%", ParagraphStyle("mc3", parent=center_style, fontSize=16, textColor=GREEN, fontName="Helvetica-Bold")),
         Paragraph("18 Months", ParagraphStyle("mc4", parent=center_style, fontSize=16, textColor=ACCENT, fontName="Helvetica-Bold"))],
    ]
    metrics_table = Table(metrics_data, colWidths=[1.65 * inch] * 4)
    metrics_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT_GRAY),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
        ("TOPPADDING", (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 12),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph(
        '"$1M gets us from 35 connected users to 10,000 active traders '
        'and 1,000 projects launched. At that scale, PNL generates $1.5M annual revenue."',
        quote_style
    ))

    elements.append(PageBreak())

    # ─── PAGE 2: ALLOCATION SUMMARY ───
    elements.append(Paragraph("Allocation Summary", h1))
    elements.append(Paragraph(
        "Every dollar mapped to a milestone. No vanity spend.", body
    ))
    elements.append(Spacer(1, 0.15 * inch))

    summary_data = [
        [Paragraph("<b>Category</b>", body_bold),
         Paragraph("<b>Amount</b>", body_bold),
         Paragraph("<b>%</b>", body_bold),
         Paragraph("<b>Purpose</b>", body_bold)],
        ["Engineering & Product", "$350,000", "35%", "Ship mobile, AI agents, security"],
        ["User Acquisition & Marketing", "$250,000", "25%", "Get to 10K active traders"],
        ["Founder Seeding & Onboarding", "$200,000", "20%", "Bootstrap the marketplace"],
        ["Legal & IP Protection", "$100,000", "10%", "Patent, regulatory, entity"],
        ["Operations & Team", "$100,000", "10%", "12-month lean runway"],
    ]
    # Convert strings to Paragraphs
    for i in range(1, len(summary_data)):
        summary_data[i] = [Paragraph(str(c), body) for c in summary_data[i]]

    summary_table = Table(summary_data, colWidths=[2.0 * inch, 1.1 * inch, 0.6 * inch, 2.9 * inch])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("BACKGROUND", (0, 1), (-1, 1), white),
        ("BACKGROUND", (0, 2), (-1, 2), ROW_ALT),
        ("BACKGROUND", (0, 3), (-1, 3), white),
        ("BACKGROUND", (0, 4), (-1, 4), ROW_ALT),
        ("BACKGROUND", (0, 5), (-1, 5), white),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(summary_table)

    # Total row
    elements.append(Spacer(1, 0.1 * inch))
    total_data = [[
        Paragraph("<b>TOTAL</b>", ParagraphStyle("t", parent=body_bold, textColor=white)),
        Paragraph("<b>$1,000,000</b>", ParagraphStyle("t2", parent=body_bold, textColor=white)),
        Paragraph("<b>100%</b>", ParagraphStyle("t3", parent=body_bold, textColor=white)),
        Paragraph("<b>18 months to revenue</b>", ParagraphStyle("t4", parent=body_bold, textColor=GREEN)),
    ]]
    total_table = Table(total_data, colWidths=[2.0 * inch, 1.1 * inch, 0.6 * inch, 2.9 * inch])
    total_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    elements.append(total_table)

    elements.append(PageBreak())

    # ─── PAGE 3: DETAILED BREAKDOWNS ───
    def add_section(title, items, total_label, total_amt):
        """items = list of (item, cost, justification)"""
        elements.append(Paragraph(title, h1))
        data = [
            [Paragraph("<b>Line Item</b>", body_bold),
             Paragraph("<b>Cost</b>", body_bold),
             Paragraph("<b>Justification</b>", body_bold)],
        ]
        for i, (item, cost, just) in enumerate(items):
            data.append([
                Paragraph(item, body),
                Paragraph(cost, body),
                Paragraph(just, body),
            ])
        t = Table(data, colWidths=[2.2 * inch, 1.0 * inch, 3.4 * inch])
        style_cmds = [
            ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]
        for i in range(1, len(data)):
            bg = ROW_ALT if i % 2 == 0 else white
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), bg))
        t.setStyle(TableStyle(style_cmds))
        elements.append(t)
        elements.append(Spacer(1, 0.05 * inch))

    # --- Engineering ---
    add_section("1. Engineering & Product  |  $350,000", [
        ("Mobile App (iOS + Android)", "$120,000",
         "Core growth channel. 80% of crypto trading happens on mobile. Launch-ready by Q3 2026."),
        ("AI Agent System", "$80,000",
         "Automated due diligence, research bots, pitch analysis. Key differentiator vs. competitors."),
        ("Infrastructure (12 months)", "$60,000",
         "Solana RPC nodes, MongoDB Atlas, Redis (Upstash), Socket.IO servers, CDN. Scales to 50K users."),
        ("Security Audits", "$50,000",
         "Smart contract audit (Solana program) + web app penetration test. Required for institutional trust."),
        ("API & Third-Party Costs", "$40,000",
         "AI model inference, Helius WebSocket, Jupiter swap routing, IPFS storage (Pinata)."),
    ], "Engineering Total", "$350,000")

    elements.append(Spacer(1, 0.1 * inch))

    # --- Seeding ---
    add_section("2. Founder Seeding & Onboarding  |  $200,000", [
        ("Seed First 50 Projects", "$100,000",
         "Bootstrap liquidity pools. A marketplace needs supply before demand. Each project seeded with ~$2K in initial trading liquidity."),
        ("Founder Grants & Incentives", "$50,000",
         "Subsidize $2 pitch fees, offer bonus rewards for quality pitches. Removes friction for early adopters."),
        ("Creator Partnerships", "$50,000",
         "Partner with 20-30 crypto builders/influencers to launch flagship projects. High-profile launches attract organic traders."),
    ], "Seeding Total", "$200,000")

    elements.append(Spacer(1, 0.1 * inch))

    # --- Marketing ---
    add_section("3. User Acquisition & Marketing  |  $250,000", [
        ("Crypto Twitter / X Campaigns", "$60,000",
         "Promoted posts, thread sponsorships, trending campaigns. Primary discovery channel for crypto-native users."),
        ("Trader Referral Program", "$60,000",
         "Pay $5-10 per active trader. Proven CAC in DeFi. Target: 6,000-12,000 traders from referrals alone."),
        ("KOL Partnerships", "$50,000",
         "10-15 Key Opinion Leaders with 50K+ followers each. One viral tweet = thousands of signups (proven by Pump.fun, Jupiter)."),
        ("Community Building", "$40,000",
         "Discord & Telegram moderators, ambassador program, community events. Retention driver."),
        ("Content & Education", "$40,000",
         "Tutorial videos, pitch guides, meme content. Lowers barrier to entry for non-crypto founders."),
    ], "Marketing Total", "$250,000")

    elements.append(PageBreak())

    # --- Legal ---
    add_section("4. Legal & IP Protection  |  $100,000", [
        ("Patent Filing", "$40,000",
         "Utility patent for prediction-market-based token launch system. Creates defensible IP moat. Provisional filed 2026, full by 2027."),
        ("Regulatory Counsel", "$40,000",
         "Structure as prediction markets (Polymarket model), not securities. Legal opinion letters for exchange listings."),
        ("Entity Structuring", "$20,000",
         "Proper corporate setup for token operations, multi-jurisdiction compliance, DAO framework."),
    ], "Legal Total", "$100,000")

    elements.append(Spacer(1, 0.15 * inch))

    # --- Ops ---
    add_section("5. Operations & Team  |  $100,000", [
        ("Team Salaries (3 founders, 12 mo)", "$60,000",
         "Below-market rate ($1,667/mo each). Founders are equity-motivated. Covers basic living expenses in Houston."),
        ("Tools & Subscriptions", "$20,000",
         "Dev tools (Vercel, GitHub, Figma), analytics (Mixpanel), monitoring (Sentry), design assets."),
        ("Reserve / Contingency", "$20,000",
         "Buffer for unexpected costs, emergency infrastructure scaling, or opportunistic partnerships."),
    ], "Ops Total", "$100,000")

    elements.append(Spacer(1, 0.3 * inch))

    # ─── MILESTONES ───
    elements.append(HRFlowable(width="100%", thickness=1, color=ACCENT))
    elements.append(Spacer(1, 0.15 * inch))
    elements.append(Paragraph("Milestones Unlocked by This Capital", h1))

    ms_data = [
        [Paragraph("<b>Milestone</b>", body_bold),
         Paragraph("<b>Target</b>", body_bold),
         Paragraph("<b>Timeline</b>", body_bold)],
        ["Mobile app live on iOS + Android", "Launch", "Q3 2026"],
        ["Active traders on platform", "10,000", "Q4 2026"],
        ["Projects launched through PNL", "1,000+", "Q1 2027"],
        ["Monthly platform revenue", "$125K/mo", "Q1 2027"],
        ["Annual run-rate revenue", "$1.5M", "Q2 2027"],
        ["Patent filed (provisional)", "Filed", "Q2 2026"],
        ["AI agent system live", "V1 Launch", "Q3 2026"],
    ]
    for i in range(1, len(ms_data)):
        ms_data[i] = [Paragraph(str(c), body) for c in ms_data[i]]

    ms_table = Table(ms_data, colWidths=[3.2 * inch, 1.5 * inch, 1.9 * inch])
    ms_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 1), (-1, 1), white),
        ("BACKGROUND", (0, 2), (-1, 2), ROW_ALT),
        ("BACKGROUND", (0, 3), (-1, 3), white),
        ("BACKGROUND", (0, 4), (-1, 4), ROW_ALT),
        ("BACKGROUND", (0, 5), (-1, 5), white),
        ("BACKGROUND", (0, 6), (-1, 6), ROW_ALT),
        ("BACKGROUND", (0, 7), (-1, 7), white),
    ]))
    elements.append(ms_table)

    elements.append(PageBreak())

    # ─── INVESTOR RETURN ───
    elements.append(Paragraph("Investor Return Scenarios", h1))
    elements.append(Paragraph(
        "Based on $1M raise at $10M pre-money valuation (9.1% equity). "
        "Revenue multiples benchmarked against Polymarket, Pump.fun, and DeFi comps.",
        body
    ))
    elements.append(Spacer(1, 0.15 * inch))

    ret_data = [
        [Paragraph("<b>Scenario</b>", body_bold),
         Paragraph("<b>Year 5 Revenue</b>", body_bold),
         Paragraph("<b>Multiple</b>", body_bold),
         Paragraph("<b>Company Value</b>", body_bold),
         Paragraph("<b>Your 9.1%</b>", body_bold),
         Paragraph("<b>Return</b>", body_bold)],
        ["Conservative", "$5M", "8x", "$40M", "$3.6M", "3.6x"],
        ["Base Case", "$15.5M", "10x", "$155M", "$14.1M", "14.1x"],
        ["Upside", "$50M", "12x", "$600M", "$54.6M", "54.6x"],
    ]
    for i in range(1, len(ret_data)):
        ret_data[i] = [Paragraph(str(c), body) for c in ret_data[i]]

    ret_table = Table(ret_data, colWidths=[1.1*inch, 1.2*inch, 0.8*inch, 1.2*inch, 1.1*inch, 1.0*inch])
    ret_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 1), (-1, 1), white),
        ("BACKGROUND", (0, 2), (-1, 2), HexColor("#eef2ff")),
        ("BACKGROUND", (0, 3), (-1, 3), white),
    ]))
    elements.append(ret_table)

    elements.append(Spacer(1, 0.3 * inch))

    # ─── VC DEAL COMBINATIONS ───
    elements.append(Paragraph("Possible Deal Structures  |  4 VCs to $1M", h1))
    elements.append(Paragraph(
        "All combinations where 4 investors reach $1M total (in $100K increments, minimum $100K each):",
        body
    ))
    elements.append(Spacer(1, 0.1 * inch))

    deal_data = [
        [Paragraph("<b>#</b>", body_bold),
         Paragraph("<b>VC 1</b>", body_bold),
         Paragraph("<b>VC 2</b>", body_bold),
         Paragraph("<b>VC 3</b>", body_bold),
         Paragraph("<b>VC 4</b>", body_bold),
         Paragraph("<b>Structure</b>", body_bold)],
        ["1", "$250K", "$250K", "$250K", "$250K", "Equal Partners"],
        ["2", "$400K", "$200K", "$200K", "$200K", "1 Lead + 3 Equal"],
        ["3", "$300K", "$300K", "$200K", "$200K", "2 Co-Leads + 2 Followers"],
        ["4", "$400K", "$300K", "$200K", "$100K", "Tiered Ladder"],
        ["5", "$300K", "$300K", "$300K", "$100K", "3 Equal + 1 Small"],
        ["6", "$400K", "$400K", "$100K", "$100K", "2 Co-Leads + 2 Small"],
        ["7", "$500K", "$200K", "$200K", "$100K", "Anchor Investor"],
        ["8", "$500K", "$300K", "$100K", "$100K", "Anchor + Medium"],
        ["9", "$600K", "$200K", "$100K", "$100K", "Dominant Lead"],
        ["10", "$700K", "$100K", "$100K", "$100K", "Single Champion"],
    ]
    for i in range(1, len(deal_data)):
        deal_data[i] = [Paragraph(str(c), body) for c in deal_data[i]]

    deal_table = Table(deal_data, colWidths=[0.4*inch, 0.9*inch, 0.9*inch, 0.9*inch, 0.9*inch, 2.6*inch])
    deal_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ] + [("BACKGROUND", (0, i), (-1, i), ROW_ALT if i % 2 == 0 else white) for i in range(1, 11)]))
    elements.append(deal_table)

    elements.append(Spacer(1, 0.2 * inch))

    # Per-VC equity table
    elements.append(Paragraph("Equity per Investment Amount", h2))
    eq_data = [
        [Paragraph("<b>Investment</b>", body_bold),
         Paragraph("<b>Equity %</b>", body_bold),
         Paragraph("<b>Base Case Value (Yr 5)</b>", body_bold),
         Paragraph("<b>Return Multiple</b>", body_bold)],
        ["$100K", "0.91%", "$1.41M", "14.1x"],
        ["$200K", "1.82%", "$2.82M", "14.1x"],
        ["$250K", "2.27%", "$3.52M", "14.1x"],
        ["$300K", "2.73%", "$4.23M", "14.1x"],
        ["$400K", "3.64%", "$5.64M", "14.1x"],
        ["$500K", "4.55%", "$7.05M", "14.1x"],
    ]
    for i in range(1, len(eq_data)):
        eq_data[i] = [Paragraph(str(c), body) for c in eq_data[i]]

    eq_table = Table(eq_data, colWidths=[1.4*inch, 1.2*inch, 2.2*inch, 1.8*inch])
    eq_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("TEXTCOLOR", (0, 0), (-1, 0), white),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ] + [("BACKGROUND", (0, i), (-1, i), ROW_ALT if i % 2 == 0 else white) for i in range(1, 7)]))
    elements.append(eq_table)

    elements.append(Spacer(1, 0.4 * inch))

    # Footer
    elements.append(HRFlowable(width="100%", thickness=1, color=BORDER))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(Paragraph(
        "PNL (Predict & Launch)  |  pnl.market  |  Confidential  |  March 2026",
        footer_style
    ))
    elements.append(Paragraph(
        "Team: Bishwanath Bastola, Jagat, Kritim  |  Houston, TX",
        footer_style
    ))

    doc.build(elements)
    print(f"PDF generated: {OUTPUT_PATH}")

if __name__ == "__main__":
    build_pdf()
