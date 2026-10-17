from pathlib import Path
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile
from xml.sax.saxutils import escape

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "test-fixtures"
FONT = ROOT / "fonts" / "f1.ttf"


def write_zip(path, entries):
    path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(path, "w") as archive:
        for name, data, compression in entries:
            archive.writestr(name, data.encode("utf-8") if isinstance(data, str) else data, compress_type=compression)


def make_docx():
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>
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
</Relationships>'''
    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/></w:rPr></w:style>
</w:styles>'''

    def p(text="", style=None, page_break=False, footnote=False):
        ppr = f'<w:pStyle w:val="{style}"/>' if style else ''
        br = '<w:br w:type="page"/>' if page_break else ''
        note = '<w:footnoteReference w:id="1"/>' if footnote else ''
        return f'<w:p><w:pPr>{ppr}</w:pPr><w:r>{br}<w:t xml:space="preserve">{escape(text)}</w:t>{note}</w:r></w:p>'

    document = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {p("اختبار القارئ الذكي", "Heading1")}
    {p("المؤلف: فريق الاختبار")}
    {p("الفصل الأول: القراءة والبحث", "Heading2")}
    {p("[ص: ١٢] القراءة المنهجية تجمع بين فهم النص، وتسجيل الفائدة، والرجوع إلى المصدر.", footnote=True)}
    {p("الفائدة الأولى هي ترتيب الأسئلة قبل البدء في البحث.")}
    {p("المبحث الثاني", "Heading2", page_break=True)}
    {p("[ج ١ ص ١٣] البحث الجيد يذكر موضع الفائدة حتى يستطيع القارئ مراجعة النص.")}
    <w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>'''
    footnotes = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
  <w:footnote w:type="continuation-separator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
  <w:footnote w:id="1"><w:p><w:r><w:t>حاشية قصيرة لاختبار ملف Word.</w:t></w:r></w:p></w:footnote>
</w:footnotes>'''
    core = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>اختبار القارئ الذكي</dc:title><dc:creator>فريق الاختبار</dc:creator></cp:coreProperties>'''
    app = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Smart Reader Fixture Generator</Application></Properties>'''
    write_zip(OUT / "sample.docx", [
        ("[Content_Types].xml", content_types, ZIP_DEFLATED),
        ("_rels/.rels", root_rels, ZIP_DEFLATED),
        ("word/_rels/document.xml.rels", document_rels, ZIP_DEFLATED),
        ("word/document.xml", document, ZIP_DEFLATED),
        ("word/styles.xml", styles, ZIP_DEFLATED),
        ("word/footnotes.xml", footnotes, ZIP_DEFLATED),
        ("docProps/core.xml", core, ZIP_DEFLATED),
        ("docProps/app.xml", app, ZIP_DEFLATED),
    ])


def make_epub():
    container = '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'''
    opf = '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0" xml:lang="ar" dir="rtl">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">smart-reader-fixture-epub</dc:identifier><dc:title>اختبار القارئ الذكي</dc:title><dc:creator>فريق الاختبار</dc:creator><dc:language>ar</dc:language></metadata>
  <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="css" href="styles.css" media-type="text/css"/><item id="ch1" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="ch2" href="chapter2.xhtml" media-type="application/xhtml+xml"/></manifest>
  <spine page-progression-direction="rtl"><itemref idref="ch1"/><itemref idref="ch2"/></spine>
</package>'''
    nav = '''<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl"><head><title>الفهرس</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><ol><li><a href="chapter1.xhtml">الفصل الأول</a></li><li><a href="chapter2.xhtml">المبحث الثاني</a></li></ol></nav></body></html>'''
    css = 'body { direction: rtl; font-family: serif; } h1, h2 { color: #1f2d4d; }'
    ch1 = '''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl"><head><title>الفصل الأول</title><link rel="stylesheet" href="styles.css"/></head><body><h1>اختبار القارئ الذكي</h1><p>المؤلف: فريق الاختبار</p><h2>الفصل الأول: القراءة والبحث</h2><p><span epub:type="pagebreak" xmlns:epub="http://www.idpf.org/2007/ops" id="page12" title="١٢">[ص: ١٢]</span> القراءة المنهجية تجمع بين فهم النص، وتسجيل الفائدة، والرجوع إلى المصدر.</p></body></html>'''
    ch2 = '''<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" lang="ar" dir="rtl"><head><title>المبحث الثاني</title><link rel="stylesheet" href="styles.css"/></head><body><h2>المبحث الثاني</h2><p>[ج ١ ص ١٣] البحث الجيد يذكر موضع الفائدة حتى يستطيع القارئ مراجعة النص.</p><p>هذه فقرة ثانية لاختبار ترتيب الفصول.</p></body></html>'''
    write_zip(OUT / "sample.epub", [
        ("mimetype", "application/epub+zip", ZIP_STORED),
        ("META-INF/container.xml", container, ZIP_DEFLATED),
        ("OEBPS/content.opf", opf, ZIP_DEFLATED),
        ("OEBPS/nav.xhtml", nav, ZIP_DEFLATED),
        ("OEBPS/styles.css", css, ZIP_DEFLATED),
        ("OEBPS/chapter1.xhtml", ch1, ZIP_DEFLATED),
        ("OEBPS/chapter2.xhtml", ch2, ZIP_DEFLATED),
    ])


def make_odt():
    mimetype = "application/vnd.oasis.opendocument.text"
    manifest = '''<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/></manifest:manifest>'''
    styles = '''<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" office:version="1.3"><office:styles><style:style style:name="Standard" style:family="paragraph"/></office:styles></office:document-styles>'''
    content = '''<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.3"><office:body><office:text><text:h text:outline-level="1">اختبار القارئ الذكي</text:h><text:p>المؤلف: فريق الاختبار</text:p><text:h text:outline-level="2">الفصل الأول: القراءة والبحث</text:h><text:p>[ص: ١٢] القراءة المنهجية تجمع بين فهم النص، وتسجيل الفائدة، والرجوع إلى المصدر.<text:note text:id="ft1" text:note-class="footnote"><text:note-citation>١</text:note-citation><text:note-body><text:p>حاشية قصيرة لاختبار ملف ODT.</text:p></text:note-body></text:note></text:p><text:h text:outline-level="2">المبحث الثاني</text:h><text:p>[ج ١ ص ١٣] البحث الجيد يذكر موضع الفائدة حتى يستطيع القارئ مراجعة النص.</text:p></office:text></office:body></office:document-content>'''
    write_zip(OUT / "sample.odt", [
        ("mimetype", mimetype, ZIP_STORED),
        ("META-INF/manifest.xml", manifest, ZIP_DEFLATED),
        ("content.xml", content, ZIP_DEFLATED),
        ("styles.xml", styles, ZIP_DEFLATED),
    ])


def shape(text):
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(text))
    except ImportError:
        return text


def make_pdf():
    pdfmetrics.registerFont(TTFont("FixtureAmiri", str(FONT)))
    path = OUT / "sample-text.pdf"
    pdf = canvas.Canvas(str(path), pagesize=(595, 842), pageCompression=1)
    pdf.setTitle("اختبار القارئ الذكي")
    pdf.setAuthor("فريق الاختبار")

    def right(text, x, y, size=14, bold=False):
        pdf.setFont("FixtureAmiri", size)
        pdf.drawRightString(x, y, shape(text))

    pdf.bookmarkPage("page-1")
    pdf.addOutlineEntry("الفصل الأول", "page-1", level=0, closed=False)
    right("اختبار القارئ الذكي", 540, 780, 20)
    right("المؤلف: فريق الاختبار", 540, 750, 13)
    right("الفصل الأول: القراءة والبحث", 540, 690, 16)
    right("[ص: ١٢] القراءة المنهجية تجمع بين فهم النص، وتسجيل الفائدة،", 540, 640)
    right("والرجوع إلى المصدر. هذه جملة إضافية لاختبار النص القابل للتحديد.", 540, 605)
    right("الفائدة الأولى هي ترتيب الأسئلة قبل البدء في البحث.", 540, 550)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(50, 40, "Smart Reader text-PDF fixture - page 1")
    pdf.showPage()

    pdf.bookmarkPage("page-2")
    pdf.addOutlineEntry("المبحث الثاني", "page-2", level=1, closed=False)
    right("المبحث الثاني", 540, 780, 18)
    right("[ج ١ ص ١٣] البحث الجيد يذكر موضع الفائدة", 540, 710)
    right("حتى يستطيع القارئ مراجعة النص والتحقق من سياقه.", 540, 675)
    right("هذه الصفحة تختبر الفهرس والعناوين والتنقل بين الصفحات.", 540, 620)
    pdf.setFont("Helvetica", 9)
    pdf.drawString(50, 40, "Smart Reader text-PDF fixture - page 2")
    pdf.save()


if __name__ == "__main__":
    make_docx()
    make_epub()
    make_odt()
    make_pdf()
    print("Created DOCX, EPUB, ODT, and text PDF fixtures.")

