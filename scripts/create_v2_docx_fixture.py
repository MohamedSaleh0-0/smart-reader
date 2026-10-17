from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-fixtures" / "v2" / "research-book.docx"


def write_zip(path, entries):
    path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(path, "w") as archive:
        for name, content in entries.items():
            payload = content if isinstance(content, bytes) else content.encode("utf-8")
            archive.writestr(name, payload, compress_type=ZIP_DEFLATED)


def p(text="", style=None, footnote_id=None, hyperlink_id=None, bold=False, page_break=False):
    ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
    props = '<w:rPr><w:b/></w:rPr>' if bold else ""
    run = f'<w:r>{props}<w:t xml:space="preserve">{escape(text)}</w:t></w:r>'
    if hyperlink_id:
        run = f'<w:hyperlink r:id="{hyperlink_id}">{run}</w:hyperlink>'
    if footnote_id is not None:
        run += f'<w:r><w:footnoteReference w:id="{footnote_id}"/></w:r>'
    break_run = '<w:r><w:br w:type="page"/></w:r>' if page_break else ''
    return f'<w:p>{ppr}{break_run}{run}</w:p>'


def split_paragraph(first, second, first_footnote_id=None, second_footnote_id=None):
    first_note = f'<w:r><w:footnoteReference w:id="{first_footnote_id}"/></w:r>' if first_footnote_id is not None else ''
    second_note = f'<w:r><w:footnoteReference w:id="{second_footnote_id}"/></w:r>' if second_footnote_id is not None else ''
    return (
        '<w:p>'
        f'<w:r><w:t xml:space="preserve">{escape(first)}</w:t></w:r>'
        '<w:r><w:br w:type="page"/></w:r>'
        f'<w:r><w:t xml:space="preserve">{escape(second)}</w:t></w:r>'
        f'{first_note}{second_note}'
        '</w:p>'
    )


def list_item(text, numbering_id):
    ppr = f'<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="{numbering_id}"/></w:numPr></w:pPr>'
    return f'<w:p>{ppr}<w:r><w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'


def cell(text, header=False):
    shading = '<w:shd w:fill="D9E2F3"/>' if header else ""
    bold = '<w:rPr><w:b/></w:rPr>' if header else ""
    return f'<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/>{shading}</w:tcPr><w:p><w:r>{bold}<w:t>{escape(text)}</w:t></w:r></w:p></w:tc>'


def row(values, header=False):
    tr_props = '<w:trPr><w:tblHeader/></w:trPr>' if header else ''
    return '<w:tr>' + tr_props + ''.join(cell(value, header) for value in values) + '</w:tr>'


def image_paragraph():
    drawing = '''<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><wp:extent cx="5000000" cy="2625000"/><wp:docPr id="1" name="research-figure" descr="مخطط يربط السؤال بالمصدر ثم بالملاحظة"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="research-figure.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId4"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5000000" cy="2625000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>'''
    return f'<w:p><w:r>{drawing}</w:r></w:p>'


def build_docx():
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>'''
    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>'''
    document_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.org/manhaj" TargetMode="External"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/research-figure.png"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>'''
    numbering = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:bidi/></w:pPr></w:lvl></w:abstractNum>
  <w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:bidi/></w:pPr></w:lvl></w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:rPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:bidi/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/><w:bidi/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/><w:bidi/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="2"/><w:bidi/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="3"/><w:bidi/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
</w:styles>'''
    table = '<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/><w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders><w:bidiVisual/></w:tblPr>' + row(["العنصر", "الغرض", "مثال"], True) + row(["السؤال", "تحديد المقصود", "ما معنى الوقت؟"]) + row(["المصدر", "مراجعة الدليل", "كتاب، فصل، فقرة"]) + row(["الملاحظة", "حفظ النتيجة", "رابط إلى المقطع"]) + '</w:tbl>'
    body = ''.join([
        p("أصول القراءة البحثية", "Heading1"),
        p("المؤلف: فريق اختبار القارئ الذكي"),
        p("هذا كتاب اختبار صغير للتحقق من أن القارئ يعرض العربية من اليمين إلى اليسار، ويحفظ بنية النص عند الاستيراد."),
        p("الفصل الأول القراءة المقصودة", "Heading2"),
        p("معنى القراءة المقصودة", "Heading3"),
        p("ليست القراءة جمعاً للنصوص فحسب، بل هي فهم السياق وتسجيل الفائدة والقدرة على الرجوع إلى المصدر عند الحاجة.", footnote_id=1),
        split_paragraph("تبدأ هذه الفقرة في الصفحة الأولى، وتحيل إلى الحاشية الأولى", "ثم تتصل في الصفحة التالية بوصفها الفقرة نفسها، وتحيل إلى الحاشية الثانية", 1, 2),
        p("الجملة المتكررة للاختبار هي: الرجوع إلى المصدر يحفظ سياق الفائدة.", bold=True),
        p("دليل المنهج", hyperlink_id="rId3"),
        list_item("حدّد السؤال قبل البدء.", 1),
        list_item("اقرأ المقطع في سياقه.", 1),
        list_item("دوّن الفائدة مع موضعها.", 1),
        list_item("يمكن أن تكون الملاحظة قصيرة.", 2),
        list_item("ويمكن أن تتحول إلى بحث مستقل.", 2),
        p("", page_break=True),
        image_paragraph(),
        p("شكل ١: مخطط مسار الملاحظة."),
        table,
        p("الفصل الثاني التوثيق والعودة", "Heading2"),
        p("لماذا نحتاج إلى رابط ثابت", "Heading3"),
        p("الجملة المتكررة للاختبار هي: الرجوع إلى المصدر يحفظ سياق الفائدة.", bold=True),
        p("إذا كانت العبارة متشابهة في موضعين، فلا يكفي البحث عن الكلمات وحدها؛ بل يحتاج النظام إلى هوية ثابتة للمقطع.", footnote_id=2),
        p("مثال في الأرقام", "Heading4"),
        p("في سنة 2026 راجع الباحث 12 مصدراً، ثم أضاف الرقم العربي ١٢ إلى ملاحظاته للمقارنة بين أنماط الأرقام."),
        p("الملاحظة البحثية الجيدة لا تنفصل عن موضعها في الكتاب."),
        p("الفصل الثالث بناء الملاحظة", "Heading2", page_break=True),
        p("من القراءة إلى البحث", "Heading3"),
        p("بعد قراءة المقطع، اكتب الفكرة بلغتك، ثم أضف النص المنقول ورابطه إلى المصدر. لا يكفي أن تتذكر العبارة؛ يجب أن تستطيع العودة إليها."),
        p("الجملة المتكررة للاختبار هي: الرجوع إلى المصدر يحفظ سياق الفائدة.", bold=True),
        p("١. تحديد السؤال"),
        p("٢. قراءة السياق"),
        p("٣. كتابة الملاحظة"),
        p("هذه صفحة ثالثة فعلية في مصدر الاختبار، وليست مجرد زيادة في طول الصفحة الأولى."),
    ])
    document = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>{body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>'''
    footnotes = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:type="continuation-separator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
  <w:footnote w:id="1"><w:p><w:r><w:t>الحاشية الأولى: المقصود بالمنهج هنا ترتيب القراءة والسؤال والتوثيق.</w:t></w:r></w:p></w:footnote>
  <w:footnote w:id="2"><w:p><w:r><w:t>الحاشية الثانية: هوية المقطع معرف داخلي ثابت، وليست عنوان الفصل وحده.</w:t></w:r></w:p></w:footnote>
</w:footnotes>'''
    core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>أصول القراءة البحثية</dc:title><dc:creator>فريق اختبار القارئ الذكي</dc:creator></cp:coreProperties>'''
    app = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Smart Reader v2 Fixture Generator</Application></Properties>'''
    write_zip(OUT, {
        "[Content_Types].xml": content_types,
        "_rels/.rels": root_rels,
        "word/_rels/document.xml.rels": document_rels,
        "word/document.xml": document,
        "word/styles.xml": styles,
        "word/numbering.xml": numbering,
        "word/footnotes.xml": footnotes,
        "word/media/research-figure.png": (OUT.parent / "research-figure.png").read_bytes(),
        "docProps/core.xml": core,
        "docProps/app.xml": app,
    })


if __name__ == "__main__":
    build_docx()
    print(OUT)
