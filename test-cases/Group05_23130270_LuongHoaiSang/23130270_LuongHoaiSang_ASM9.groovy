import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.webui.driver.DriverFactory
import com.kms.katalon.core.configuration.RunConfiguration
import org.openqa.selenium.*
import org.openqa.selenium.interactions.Actions
import org.openqa.selenium.support.ui.Select

// ===================== CAU HINH =====================
String URL = 'https://demo.mahocommerce.com/admin2941834/'
String SV  = '23130270'          // MSSV
double K = 0.3                   // he so cho: 0.3 chay on dinh | 1.0 = cham (de quay video cho giang vien)
def nap = { long ms -> Thread.sleep((long)(ms * K)) }
def idle = { int maxMs ->
    long end = System.currentTimeMillis() + maxMs
    Thread.sleep(60)
    while (System.currentTimeMillis() < end) {
        try {
            boolean ok = ((JavascriptExecutor) DriverFactory.getWebDriver()).executeScript("var m=document.querySelector('#loading-mask,.loading-mask,.ajax-loading');return document.readyState==='complete' && !(m && m.offsetParent!==null) && !(window.Ajax && Ajax.activeRequestCount>0) && !(window.jQuery && jQuery.active>0);") as boolean
            if (ok) { return }
        } catch (Throwable t) { }
        Thread.sleep(40)
    }
}
int PAUSE  = 1000
String RUN = new Date().format('HHmmss')
String EVID = RunConfiguration.getProjectDir() + '/Evidence'
new File(EVID).mkdirs()

// ===================== HAM NEN =====================
def drv = { DriverFactory.getWebDriver() }
def exe = { String s, Object a -> JavascriptExecutor je = (JavascriptExecutor) drv(); return (a == null) ? je.executeScript(s) : je.executeScript(s, a) }
def shot = { String n -> try { WebUI.takeScreenshot(EVID + '/' + n + '.png') } catch (Throwable t) { } }
String curId = ''

def find = { String x, int sec ->
    long end = System.currentTimeMillis() + sec * 1000L
    while (true) {
        try { for (WebElement e : drv().findElements(By.xpath(x))) { if (e.isDisplayed()) { return e } } } catch (Throwable t) { }
        if (System.currentTimeMillis() > end) { return null }
        Thread.sleep(40)
    }
}
def must = { String x, String what, int sec = 6 ->
    WebElement e = find(x, sec)
    if (e == null) { throw new AssertionError('Khong tim thay: ' + what) }
    return e
}
def hl = { WebElement e ->
    try { exe("arguments[0].scrollIntoView({block:'center'});arguments[0].style.outline='4px solid red';arguments[0].style.backgroundColor='#fff176';", e) } catch (Throwable t) { }
}
def say = { String text ->
    try { exe("var b=document.getElementById('qa_banner'); if(!b){b=document.createElement('div');b.id='qa_banner';b.style='position:fixed;top:0;right:0;z-index:999999;background:#d50000;color:#fff;font:bold 18px Arial;padding:8px 16px;max-width:60%;';document.body.appendChild(b);} b.innerText=arguments[0];", curId + ' - ' + text) } catch (Throwable t) { }
}

def click = { WebElement e -> hl(e); nap(600); try { e.click() } catch (Throwable t) { exe('arguments[0].click();', e) }; idle(4000) }
def btnXp = { String t -> ("//button[normalize-space(.)='" + t + "'] | //a[normalize-space(.)='" + t + "'] | //*[@role='button' and normalize-space(.)='" + t + "'] | //input[@type='button' and @value='" + t + "']").toString() }
def btn = { String t -> say('Bam ' + t); click(must(btnXp(t), 'Nut ' + t)) }
def btnPresent = { String t, int s -> return find(btnXp(t), s) != null }

def fieldXp = { List labels, String idFb ->
    String c = labels.collect { "contains(normalize-space(.),'" + it + "')" }.join(' or ')
    String x = "//*[@id=//label[" + c + "]/@for]"
    if (idFb) { x += " | //*[@id='" + idFb + "']" }
    return x
}
def typeIn = { List labels, String idFb, String v ->
    say('Nhap ' + labels[0] + ': ' + (v.length() > 25 ? v.substring(0, 25) + '...' : v))
    WebElement e = must(fieldXp(labels, idFb), 'O nhap "' + labels[0] + '"')
    hl(e); e.clear(); if (v) { e.sendKeys(v) }; nap(PAUSE)
}
def sel = { List labels, String idFb, String text ->
    say('Chon ' + labels[0] + ' = ' + text)
    WebElement e = must(fieldXp(labels, idFb), 'O chon "' + labels[0] + '"')
    hl(e)
    Select s = new Select(e)
    def o = s.options.find { it.text.trim().toLowerCase().contains(text.toLowerCase()) }
    if (o == null) { throw new AssertionError('Khong co lua chon "' + text + '" o ' + labels[0]) }
    s.selectByVisibleText(o.text); nap(PAUSE)
}
def pickIdx = { List labels, String idFb, int idx ->
    WebElement e = find(fieldXp(labels, idFb), 2)
    if (e != null) { try { say('Chon ' + labels[0]); hl(e); new Select(e).selectByIndex(idx); nap(PAUSE) } catch (Throwable t) { } }
}
def setContent = { String id, String v ->
    say('Nhap noi dung')
    try { exe("var e=document.getElementById('" + id + "'); if(e){e.value=arguments[0];}", v) } catch (Throwable t) { }
    nap(PAUSE)
}

def goGrid = { String sub ->
    try { drv().switchTo().alert().accept() } catch (Throwable t) { }
    say('Mo menu CMS > ' + sub)
    must("//*[normalize-space(text())='CMS']", 'Menu CMS', 15)
    String href = null
    long end = System.currentTimeMillis() + 8000
    while (href == null && System.currentTimeMillis() < end) {
        try {
            href = exe("var s=arguments[0];var a=[].slice.call(document.querySelectorAll('a')).filter(function(x){return x.textContent.trim()===s && x.href && x.href.indexOf('javascript')<0 && x.href.slice(-1)!=='#'});return a.length?a[0].href:null;", sub) as String
        } catch (Throwable t) { }
        if (href == null) { Thread.sleep(200) }
    }
    if (href != null) {
        WebUI.navigateToUrl(href); idle(4000)
    } else {
        WebElement top = must("//*[normalize-space(text())='CMS']", 'Menu CMS', 12)
        hl(top)
        try { new Actions(drv()).moveToElement(top).perform() } catch (Throwable t) { }
        Thread.sleep(800)
        String sx = "//*[normalize-space(text())='" + sub + "']"
        WebElement s = find(sx, 4)
        if (s == null) { click(top); s = find(sx, 4) }
        if (s == null) { throw new AssertionError('Khong tim thay: Menu ' + sub) }
        click(s); idle(4000)
    }
    if (btnPresent('Reset Filter', 2)) { btn('Reset Filter'); idle(4000) }
}
def goTab = { String n ->
    say('Chuyen tab: ' + n)
    click(must("//ul[contains(@id,'tabs')]//a[contains(normalize-space(.),'" + n + "')] | //*[normalize-space(text())='" + n + "']", 'Tab ' + n))
}
def said    = { String p, int s = 8 -> return find("//*[text()[contains(.,'" + p + "')]]", s) != null }
def saved   = { return said('has been saved') }
def blocked = {
    idle(4000)
    boolean ok = find("//*[text()[contains(.,'has been saved')]]", 1) != null
    String low = "translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz')"
    String x = "//*[not(self::option) and not(self::script) and text()[contains(" + low + ",'required') or contains(" + low + ",'already') or contains(" + low + ",'exist') or contains(" + low + ",'valid') or contains(" + low + ",'at least') or contains(" + low + ",'error')]] | //*[contains(@class,'validation-advice') or contains(@class,'error-msg')]"
    boolean err = find(x, 2) != null
    boolean inv = false
    try { inv = exe("return document.querySelectorAll('input:invalid,select:invalid').length>0;", null) } catch (Throwable t) { }
    return (err || inv) && !ok
}
def filter = { String col, String v ->
    say('Loc o cot ' + col + ': ' + (v.length() > 25 ? v.substring(0, 25) + '...' : v))
    WebElement e = must("//input[@name='" + col + "']", 'O loc cot ' + col)
    hl(e); e.clear(); e.sendKeys(v); e.sendKeys(Keys.ENTER)
    idle(5000)
}
def rowXp   = { String t -> ("//tr[td[contains(normalize-space(.),'" + t + "')]]").toString() }
def gridHas = { String t -> return find(rowXp(t), 4) != null }
def openRow = { String t -> say('Mo dong: ' + t.substring(0, Math.min(25, t.length()))); click(must(rowXp(t) + "/td[contains(normalize-space(.),'" + t + "')]", 'Dong chua ' + t)); idle(4000) }
def delItem = { String sub, String col, String t ->
    goGrid(sub); filter(col, t); openRow(t)
    btn('Delete'); nap(1000)
    say('Xac nhan xoa (OK)')
    try { drv().switchTo().alert().accept() } catch (Throwable x) { }
    WebElement ok = find("//button[normalize-space(.)='OK' or normalize-space(.)='Yes' or normalize-space(.)='Confirm']", 1)
    if (ok != null) { click(ok) }
    idle(4000)
}

// ===================== NGHIEP VU =====================
def SB_T = ['Title']; def SB_I = ['Identifier']; def SB_S = ['Status', 'Enable']
def WG_T = ['Widget Instance Title', 'Title']
def createWidget = { String t, String sort, boolean withStore ->
    goGrid('Widgets'); btn('Add')
    sel(['Type'], 'instance_code', 'Orders and Returns')
    pickIdx(['Design Package'], 'theme_id', 1)
    btn('Continue'); idle(4000)
    goTab('Frontend Properties')
    typeIn(WG_T, 'title', t)
    if (withStore) { pickIdx(['Assign to Store Views', 'Store View'], 'store_ids', 0) }
    typeIn(['Sort Order'], 'sort_order', sort)
    btn('Save')
}

// ===================== DANG NHAP =====================
WebUI.openBrowser('')
WebUI.maximizeWindow()
WebUI.navigateToUrl(URL)
curId = 'LOGIN'
typeIn(['User Name', 'Username'], 'username', 'demo')
typeIn(['Password'], 'login', 'demo1234demo1234')
shot('00_login_filled')
btn('Login')
must("//*[normalize-space(text())='CMS']", 'Menu CMS sau khi dang nhap', 25)
shot('00_login_success')

// ===================== KHUNG PROBE =====================
// Moi test chi giu lai neu da cho SUSPECT_DEFECT trong cac lan chay truoc.
// Van phai tu tai hien bang tay + quay video/chup anh truoc khi ghi vao Defect List.
List obs = []
def pageMsg = {
    try { return String.valueOf(exe("var e=document.querySelector('.messages,.error-msg,.validation-advice,.notice-msg,.success-msg');return e?e.innerText:'';", null)).replaceAll('[\\r\\n,]', ' ') } catch (Throwable t) { return '' }
}
def outcome = {
    if (said('has been saved', 1)) { return 'SAVED' }
    if (blocked()) { return 'BLOCKED' }
    return 'OTHER'
}
def rec = { String id, String desc, String expect, String actual, String msg ->
    String v = (expect.tokenize('|').contains(actual)) ? 'AS_EXPECTED' : (actual == 'ERROR' ? 'CHECK_SCRIPT' : 'SUSPECT_DEFECT')
    obs << [id, desc, expect, actual, v, msg]
    println('[' + v + '] ' + id + ' | expect=' + expect + ' actual=' + actual + ' | ' + desc + ' | ' + msg)
}
String ONLY = ''     // vi du: 'DSB_05,DWG_12' de chi chay lai vai test. De trong = chay het
String lastAlert = ''
String P = 'ADV' + RUN + SV

def acceptAlert = { try { Alert a = drv().switchTo().alert(); lastAlert = a.getText(); a.accept(); return true } catch (Throwable x) { return false } }
def relogin = {
    WebUI.navigateToUrl(URL)
    typeIn(['User Name', 'Username'], 'username', 'demo'); typeIn(['Password'], 'login', 'demo1234demo1234'); btn('Login')
    must("//*[normalize-space(text())='CMS']", 'Menu CMS', 25)
}
def needLogin = { try { return exe("return !!document.getElementById('username');", null) as boolean } catch (Throwable x) { return false } }
def val = { String id -> try { return String.valueOf(exe("var e=document.getElementById(arguments[0]);return e?e.value:null;", id)) } catch (Throwable x) { return null } }
def rowCount = { String t -> try { return ((Number) exe("var t=arguments[0];return [].slice.call(document.querySelectorAll('tbody tr')).filter(function(r){return r.innerText.indexOf(t)>=0}).length;", t)).intValue() } catch (Throwable x) { return -1 } }
def countText = { String t -> try { return ((Number) exe("var t=arguments[0];return document.body.innerText.split(t).length-1;", t)).intValue() } catch (Throwable x) { return -1 } }
def errWords = { String s -> (s ?: '').toLowerCase().find(/error|invalid|not allowed|cannot|can't|failed|exist|already|illegal|forbidden|denied|required|wrong/) != null }
def toGrid = { String sub, String col, String t -> goGrid(sub); filter(col, t) }
def ti = { String id -> P + id }
def idf = { String id -> (id + RUN).toLowerCase() }

def T = { String id, String desc, String expect, Closure body ->
    if (ONLY && !ONLY.split(',').toList().contains(id)) { return }
    curId = id; say(desc)
    String actual = ''; String m = ''
    try {
        def r = body()
        actual = (r instanceof CharSequence && r.toString()) ? r.toString() : outcome()
        m = pageMsg(); shot(id)
    } catch (Throwable t) { actual = 'ERROR'; m = String.valueOf(t.getMessage()).replaceAll('[\\r\\n,]', ' '); shot(id + '_ERR') }
    rec(id, desc, expect, actual, m)
    try {
        acceptAlert()
        List hs = drv().getWindowHandles().toList()
        if (hs.size() > 1) { for (int i = 1; i < hs.size(); i++) { drv().switchTo().window(hs[i]); drv().close() }; drv().switchTo().window(hs[0]) }
        WebUI.navigateToUrl(URL)
        idle(3000)
        if (needLogin()) { relogin() }
    } catch (Throwable t) { }
    idle(4000)
}
def sweep = { String sub, String col ->
    for (int i = 0; i < 80; i++) {
        try { goGrid(sub); filter(col, P); if (!gridHas(P)) { break }; delItem(sub, col, P) } catch (Throwable x) { println('sweep ' + sub + ': ' + x.getMessage()); break }
    }
}
def newBlockS = { String t, String ident, String status, String content ->
    goGrid('Static Blocks'); btn('Add')
    typeIn(SB_T, 'block_title', t); typeIn(SB_I, 'block_identifier', ident)
    pickIdx(['Store View'], 'block_stores', 0)
    sel(SB_S, 'block_is_active', status)
    setContent('block_content', content)
    btn('Save')
}
def openB = { String id -> toGrid('Static Blocks', 'title', ti(id)); openRow(ti(id)) }
def mkW = { String id, String sort -> createWidget(ti(id), sort, true) }
def openW = { String id -> toGrid('Widgets', 'title', ti(id)); openRow(ti(id)); goTab('Frontend Properties') }
def sortProbe = { String id, String sort ->
    createWidget(ti(id), sort, true)
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openW(id); return 'SAVED_input=' + sort + '_stored=' + val('sort_order')
}
// Gui form bang JS, bo qua validation phia trinh duyet (de test validation phia server)
def rawSubmit = {
    exe("var f=document.getElementById('edit_form')||document.querySelector('form[id*=edit]');HTMLFormElement.prototype.submit.call(f);return 1;", null)
    idle(4000)
}
def newFolder = { String name ->
    goGrid('Media Library'); idle(4000)
    WebElement b = must("//button[contains(normalize-space(.),'Create Folder')]", 'Nut Create Folder', 8)
    hl(b); nap(600)
    try { b.click() } catch (Throwable x) { }
    Thread.sleep(800)
    Alert a = drv().switchTo().alert()
    a.sendKeys(name); a.accept()
    Thread.sleep(2500); idle(4000)
    acceptAlert()
}

// =====================================================================
// STATIC BLOCKS  (11 test, tat ca da cho SUSPECT_DEFECT)
// =====================================================================
// --- D1: khong gioi han do dai ---
T('DSB_01', 'Title 256 ky tu van duoc luu (vuot gioi han 255)', 'BLOCKED', {
    newBlockS(ti('dsb01').padRight(256, 'L'), idf('dsb01'), 'Enabled', 'x')
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openB('dsb01'); 'SAVED_input_len=256_stored_len=' + val('block_title').length() })
T('DSB_02', 'Identifier 256 ky tu van duoc luu (vuot gioi han 255)', 'BLOCKED', {
    newBlockS(ti('dsb02'), ('d7' + RUN).padRight(256, 'i'), 'Enabled', 'x')
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openB('dsb02'); 'SAVED_input_len=256_stored_len=' + val('block_identifier').length() })
T('DSB_03', 'Title 5000 ky tu van duoc luu', 'BLOCKED', {
    newBlockS(ti('dsb03').padRight(5000, 'L'), idf('dsb03'), 'Enabled', 'x')
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openB('dsb03'); 'SAVED_input_len=5000_stored_len=' + val('block_title').length() })
// --- D9: Identifier trung khac hoa/thuong ---
T('DSB_04', 'Identifier trung khac hoa/thuong van tao duoc 2 block', 'BLOCKED', {
    newBlockS(ti('dsb04a'), idf('dsb04'), 'Enabled', 'x'); newBlockS(ti('dsb04b'), idf('dsb04').toUpperCase(), 'Enabled', 'x')
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    toGrid('Static Blocks', 'identifier', idf('dsb04')); 'DUPLICATE_CREATED(rows=' + rowCount(P) + ')' })
// --- D2: lost update 2 tab ---
T('DSB_05', 'Sua cung 1 block o 2 tab: tab cu ghi de tab moi (lost update)', 'BLOCKED|CONFLICT_WARNING', {
    newBlockS(ti('dsb05'), idf('dsb05'), 'Enabled', 'orig'); openB('dsb05')
    String url = drv().getCurrentUrl(); String h1 = drv().getWindowHandle()
    exe('window.open(arguments[0]);', url); nap(2500)
    String h2 = drv().getWindowHandles().find { it != h1 }
    drv().switchTo().window(h2); idle(4000)
    setContent('block_content', 'from_tab2'); typeIn(SB_T, 'block_title', ti('dsb05') + '_t2'); btn('Save'); saved()
    drv().switchTo().window(h1)
    setContent('block_content', 'from_tab1'); btn('Save'); String s1 = outcome()
    toGrid('Static Blocks', 'title', ti('dsb05')); openRow(ti('dsb05'))
    s1 == 'SAVED' ? ('SILENT_OVERWRITE(tab2_title_lost; stored_title=' + val('block_title') + '; stored_content=' + val('block_content') + ')') : s1 })
// --- D12: khong trim khoang trang ---
T('DSB_06', 'Title co khoang trang dau/cuoi khong bi trim', 'TRIMMED|BLOCKED', {
    newBlockS('   ' + ti('dsb06') + '  ', idf('dsb06'), 'Enabled', 'x')
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openB('dsb06'); String v = val('block_title'); (v == v?.trim()) ? 'TRIMMED' : 'NOT_TRIMMED(stored=[' + v + '])' })
// --- D7: Title zero-width ---
T('DSB_07', 'Title chi gom ky tu zero-width (nhin nhu rong) van duoc luu', 'BLOCKED', {
    newBlockS('\u200B\u200B\u200B', idf('dsb07'), 'Enabled', 'x')
    outcome() == 'SAVED' ? 'SAVED_zero_width_title' : 'BLOCKED' })
// --- D4/D5/D6: server khong validate (bo qua validation client bang JS) ---
T('DSB_08', 'Bo qua validation client: Identifier rong van duoc luu', 'BLOCKED', {
    goGrid('Static Blocks'); btn('Add')
    typeIn(SB_T, 'block_title', ti('dsb08')); typeIn(SB_I, 'block_identifier', '')
    pickIdx(['Store View'], 'block_stores', 0); sel(SB_S, 'block_is_active', 'Enabled'); setContent('block_content', 'x')
    rawSubmit()
    outcome() == 'SAVED' ? 'SAVED_EMPTY_IDENTIFIER' : 'BLOCKED' })
T('DSB_09', 'Bo qua validation client: Identifier chi gom khoang trang van duoc luu', 'BLOCKED', {
    goGrid('Static Blocks'); btn('Add')
    typeIn(SB_T, 'block_title', ti('dsb09')); typeIn(SB_I, 'block_identifier', '     ')
    pickIdx(['Store View'], 'block_stores', 0); sel(SB_S, 'block_is_active', 'Enabled'); setContent('block_content', 'x')
    rawSubmit()
    outcome() == 'SAVED' ? 'SAVED_BLANK_IDENTIFIER' : 'BLOCKED' })
T('DSB_10', 'Bo qua validation client: khong chon Store View van luu duoc block', 'BLOCKED', {
    goGrid('Static Blocks'); btn('Add')
    typeIn(SB_T, 'block_title', ti('dsb10')); typeIn(SB_I, 'block_identifier', idf('dsb10'))
    sel(SB_S, 'block_is_active', 'Enabled'); setContent('block_content', 'x')
    exe("var s=document.getElementById('block_stores'); if(s){for(var i=0;i<s.options.length;i++){s.options[i].selected=false;}}", null)
    rawSubmit()
    outcome() == 'SAVED' ? 'SAVED_NO_STORE' : 'BLOCKED' })
T('DSB_11', 'Bo qua validation client: Status = 99 (gia tri khong hop le) van duoc luu', 'BLOCKED', {
    goGrid('Static Blocks'); btn('Add')
    typeIn(SB_T, 'block_title', ti('dsb11')); typeIn(SB_I, 'block_identifier', idf('dsb11'))
    pickIdx(['Store View'], 'block_stores', 0); setContent('block_content', 'x')
    exe("var s=document.getElementById('block_is_active');var o=document.createElement('option');o.value='99';o.text='x99';s.appendChild(o);s.value='99';return 1;", null)
    rawSubmit()
    outcome() == 'SAVED' ? 'SAVED_INVALID_STATUS_99' : 'BLOCKED' })

// =====================================================================
// WIDGETS  (12 test, tat ca da cho SUSPECT_DEFECT)
// =====================================================================
// --- D1: khong gioi han do dai ---
T('DWG_01', 'Title 256 ky tu van duoc luu (vuot gioi han 255)', 'BLOCKED', {
    createWidget(ti('dwg01').padRight(256, 'L'), '1', true)
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openW('dwg01'); 'SAVED_input_len=256_stored_len=' + val('title').length() })
T('DWG_02', 'Title 5000 ky tu van duoc luu', 'BLOCKED', {
    createWidget(ti('dwg02').padRight(5000, 'L'), '1', true)
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openW('dwg02'); 'SAVED_input_len=5000_stored_len=' + val('title').length() })
// --- D12: khong trim ---
T('DWG_03', 'Title co khoang trang dau/cuoi khong bi trim', 'TRIMMED|BLOCKED', {
    createWidget('   ' + ti('dwg03') + '  ', '1', true)
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openW('dwg03'); String v = val('title'); (v == v?.trim()) ? 'TRIMMED' : 'NOT_TRIMMED(stored=[' + v + '])' })
// --- D7: Title zero-width ---
T('DWG_04', 'Title chi gom ky tu zero-width (nhin nhu rong) van duoc luu', 'BLOCKED', {
    createWidget('\u200B\u200B\u200B', '1', true)
    outcome() == 'SAVED' ? 'SAVED_zero_width_title' : 'BLOCKED' })
// --- D8: Sort Order vuot INT ---
T('DWG_05', 'Sort Order = 99999999999999 (vuot INT) van duoc luu', 'BLOCKED', { sortProbe('dwg05', '99999999999999') })
T('DWG_06', 'Sort Order = 2147483648 (max INT + 1) van duoc luu', 'BLOCKED', { sortProbe('dwg06', '2147483648') })
// --- D10: Sort Order bi doi im lang ---
T('DWG_07', 'Sort Order = 1.5 bi luu thanh 1', 'BLOCKED', { sortProbe('dwg07', '1.5') })
T('DWG_08', 'Sort Order = 1e3 bi luu thanh 1000', 'BLOCKED', { sortProbe('dwg08', '1e3') })
// --- D11: Sort Order am ---
T('DWG_09', 'Sort Order = -5 van duoc luu', 'BLOCKED', { sortProbe('dwg09', '-5') })
T('DWG_10', 'Khi sua: Sort Order = -9 van duoc luu', 'BLOCKED', {
    mkW('dwg10', '1'); openW('dwg10'); typeIn(['Sort Order'], 'sort_order', '-9'); btn('Save')
    if (outcome() != 'SAVED') { return 'BLOCKED' }
    openW('dwg10'); 'SAVED_input=-9_stored=' + val('sort_order') })
// --- D3: Back roi Save lai tao widget trung ---
T('DWG_11', 'Back sau khi Save roi Save lai tao ra widget trung', '1 row(s)', {
    mkW('dwg11', '1'); saved(); drv().navigate().back(); idle(3000)
    if (btnPresent('Save', 2)) { btn('Save') }; acceptAlert()
    toGrid('Widgets', 'title', ti('dwg11')); rowCount(ti('dwg11')) + ' row(s)' })
// --- D2: lost update 2 tab ---
T('DWG_12', 'Sua cung widget o 2 tab: tab cu ghi de tab moi (lost update)', 'BLOCKED|CONFLICT_WARNING', {
    mkW('dwg12', '5'); openW('dwg12')
    String url = drv().getCurrentUrl(); String h1 = drv().getWindowHandle()
    exe('window.open(arguments[0]);', url); nap(2500)
    String h2 = drv().getWindowHandles().find { it != h1 }
    drv().switchTo().window(h2); idle(4000); goTab('Frontend Properties')
    typeIn(WG_T, 'title', ti('dwg12') + '_t2'); btn('Save'); saved()
    drv().switchTo().window(h1)
    typeIn(['Sort Order'], 'sort_order', '11'); btn('Save'); String s1 = outcome()
    toGrid('Widgets', 'title', ti('dwg12')); openRow(ti('dwg12')); goTab('Frontend Properties')
    s1 == 'SAVED' ? ('SILENT_OVERWRITE(tab2_title_lost; stored_title=' + val('title') + '; sort=' + val('sort_order') + ')') : s1 })

// =====================================================================
// MEDIA LIBRARY  (1 test cho SUSPECT_DEFECT)
// Cac test upload file hien script chua tim duoc input[type=file] -> hay test THU CONG
// =====================================================================
T('DML_01', 'Ten thu muc trung khac hoa/thuong van tao duoc 2 thu muc', 'BLOCKED', {
    String n = 'at_c' + RUN
    newFolder(n); lastAlert = ''
    newFolder(n.toUpperCase())
    String msg = (lastAlert + ' ' + pageMsg())
    if (errWords(msg)) { return 'BLOCKED' }
    countText(n.toUpperCase()) > 0 ? 'CASE_DUPLICATE_CREATED' : 'BLOCKED' })

// ---- Don dep du lieu test (chi xoa ban ghi co tien to P) ----
// Luu y: block/widget Title zero-width (DSB_07, DWG_04) khong co tien to P nen phai xoa tay.
// Thu muc Media Library (at_c...) cung phai xoa tay.
sweep('Static Blocks', 'title')
sweep('Widgets', 'title')

// ===================== BAO CAO =====================
File csv2 = new File(EVID + '/ASM9_result_' + RUN + '.csv')
csv2.text = 'ID,Mo ta,Ky vong,Thuc te,Verdict,Thong bao cua web\n' + obs.collect { r -> r.collect { String.valueOf(it).replace(',', ';') }.join(',') }.join('\n')
['DSB', 'DWG', 'DML'].each { g ->
    List rows = obs.findAll { it[0].startsWith(g) }
    println(g + ': tong ' + rows.size() + ' | SUSPECT ' + rows.count { it[4] == 'SUSPECT_DEFECT' } + ' | AS_EXPECTED ' + rows.count { it[4] == 'AS_EXPECTED' } + ' | CHECK_SCRIPT ' + rows.count { it[4] == 'CHECK_SCRIPT' })
}
println('SUSPECT_DEFECT: ' + obs.findAll { it[4] == 'SUSPECT_DEFECT' }.collect { it[0] }.join(', '))
println('CSV: ' + csv2.absolutePath)
nap(3000)
WebUI.closeBrowser()