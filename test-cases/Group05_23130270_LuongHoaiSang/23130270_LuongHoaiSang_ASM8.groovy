import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.webui.driver.DriverFactory
import com.kms.katalon.core.configuration.RunConfiguration
import com.kms.katalon.core.util.KeywordUtil
import org.openqa.selenium.*
import org.openqa.selenium.interactions.Actions
import org.openqa.selenium.support.ui.Select

// ===================== CAU HINH =====================
String URL = 'https://demo.mahocommerce.com/admin2941834/'
String SV  = 'SV001'          // <-- doi thanh MSSV
int PAUSE  = 1000             // mili-giay dung sau moi thao tac (2000-3000 khi quay cho giang vien)
String RUN = new Date().format('HHmmss')
String EVID = RunConfiguration.getProjectDir() + '/Evidence'
new File(EVID).mkdirs()
List results = []
String curId = ''
int dumps = 0

// ===================== HAM NEN =====================
def drv = { DriverFactory.getWebDriver() }
def exe = { String s, Object a -> ((JavascriptExecutor) drv()).executeScript(s, a) }
def shot = { String n -> try { WebUI.takeScreenshot(EVID + '/' + n + '.png') } catch (Throwable t) { } }
def check = { boolean c, String m -> if (!c) { throw new AssertionError(m) } }

def find = { String x, int sec ->
    long end = System.currentTimeMillis() + sec * 1000L
    while (true) {
        try { for (WebElement e : drv().findElements(By.xpath(x))) { if (e.isDisplayed()) { return e } } } catch (Throwable t) { }
        if (System.currentTimeMillis() > end) { return null }
        Thread.sleep(300)
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
def dump = {
    try {
        String r = String.valueOf(exe("var o=[];document.querySelectorAll('button,a,input,select,textarea,label,th').forEach(function(e){if(e.offsetParent===null)return;o.push(e.tagName+' | id='+e.id+' | name='+(e.name||'')+' | text='+(e.innerText||e.value||'').trim().substring(0,40));});return o.join('\\n');", null))
        println('===== PHAN TU DANG HIEN (' + curId + ') ' + drv().getCurrentUrl() + ' =====\n' + r + '\n===== HET =====')
    } catch (Throwable t) { }
}

// ----- thao tac co hien thi -----
def click = { WebElement e -> hl(e); Thread.sleep(600); try { e.click() } catch (Throwable t) { exe('arguments[0].click();', e) }; Thread.sleep(PAUSE) }
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
    hl(e); e.clear(); if (v) { e.sendKeys(v) }; Thread.sleep(PAUSE)
}
def sel = { List labels, String idFb, String text ->
    say('Chon ' + labels[0] + ' = ' + text)
    WebElement e = must(fieldXp(labels, idFb), 'O chon "' + labels[0] + '"')
    hl(e)
    Select s = new Select(e)
    def o = s.options.find { it.text.trim().toLowerCase().contains(text.toLowerCase()) }
    if (o == null) { throw new AssertionError('Khong co lua chon "' + text + '" o ' + labels[0]) }
    s.selectByVisibleText(o.text); Thread.sleep(PAUSE)
}
def pickIdx = { List labels, String idFb, int idx ->
    WebElement e = find(fieldXp(labels, idFb), 2)
    if (e != null) { try { say('Chon ' + labels[0]); hl(e); new Select(e).selectByIndex(idx); Thread.sleep(PAUSE) } catch (Throwable t) { } }
}
def setContent = { String id, String v ->
    say('Nhap noi dung')
    try { exe("var e=document.getElementById('" + id + "'); if(e){e.value=arguments[0];}", v) } catch (Throwable t) { }
    Thread.sleep(PAUSE)
}

// ----- menu, tab, thong bao, grid -----
def goGrid = { String sub ->
    try { drv().switchTo().alert().accept() } catch (Throwable t) { }
    say('Mo menu CMS > ' + sub)
    WebElement top = must("//*[normalize-space(text())='CMS']", 'Menu CMS', 12)
    hl(top)
    try { new Actions(drv()).moveToElement(top).perform() } catch (Throwable t) { }
    Thread.sleep(700)
    String sx = "//*[normalize-space(text())='" + sub + "']"
    WebElement s = find(sx, 3)
    if (s == null) { click(top); s = must(sx, 'Menu ' + sub) }
    click(s)
    Thread.sleep(1500)
    if (btnPresent('Reset Filter', 2)) { btn('Reset Filter'); Thread.sleep(1500) }
}
def goTab = { String n ->
    say('Chuyen tab: ' + n)
    click(must("//ul[contains(@id,'tabs')]//a[contains(normalize-space(.),'" + n + "')] | //*[normalize-space(text())='" + n + "']", 'Tab ' + n))
}
def said    = { String p, int s = 8 -> return find("//*[text()[contains(.,'" + p + "')]]", s) != null }
def saved   = { return said('has been saved') }
def deleted = { return said('has been deleted') }
def blocked = {
    Thread.sleep(1500)
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
    Thread.sleep(2500)
}
def rowXp   = { String t -> ("//tr[td[contains(normalize-space(.),'" + t + "')]]").toString() }
def gridHas = { String t -> return find(rowXp(t), 4) != null }
def noRec   = { return find("//td[contains(normalize-space(.),'No records')]", 4) != null }
def openRow = { String t -> say('Mo dong: ' + t.substring(0, Math.min(25, t.length()))); click(must(rowXp(t) + "/td[contains(normalize-space(.),'" + t + "')]", 'Dong chua ' + t)); Thread.sleep(1500) }
def delItem = { String sub, String col, String t ->
    goGrid(sub); filter(col, t); openRow(t)
    btn('Delete'); Thread.sleep(1000)
    say('Xac nhan xoa (OK)')
    try { drv().switchTo().alert().accept() } catch (Throwable x) { }
    WebElement ok = find("//button[normalize-space(.)='OK' or normalize-space(.)='Yes' or normalize-space(.)='Confirm']", 1)
    if (ok != null) { click(ok) }
    Thread.sleep(1500)
}

def runTest = { String id, String name, Closure body ->
    curId = id
    say(name)
    try {
        body(); shot(id + '_PASS')
        results << [id, name, 'PASS', '']
        println('[PASS] ' + id + ' - ' + name)
    } catch (Throwable t) {
        shot(id + '_FAIL')
        results << [id, name, 'FAIL', String.valueOf(t.getMessage()).replaceAll('[\\r\\n,]', ' ')]
        println('[FAIL] ' + id + ' - ' + name + ' --> ' + t.getMessage())
        if (dumps < 3) { dumps++; dump() }
    }
    try { WebUI.navigateToUrl(URL) } catch (Throwable t) { try { drv().switchTo().alert().accept(); WebUI.navigateToUrl(URL) } catch (Throwable x) { } }
    Thread.sleep(1200)
}

// ===================== NGHIEP VU =====================
// ---- Static Blocks ----
def SB_T = ['Title']; def SB_I = ['Identifier']; def SB_S = ['Status', 'Enable']
def createBlock = { String t, String ident, String status, String content ->
    goGrid('Static Blocks'); btn('Add')
    typeIn(SB_T, 'block_title', t); typeIn(SB_I, 'block_identifier', ident)
    pickIdx(['Store View'], 'block_stores', 0)
    sel(SB_S, 'block_is_active', status)
    setContent('block_content', content)
    btn('Save')
}
def editBlock = { String oldT, Closure edit -> goGrid('Static Blocks'); filter('title', oldT); openRow(oldT); edit(); btn('Save') }
String sbA = 'AT_SB_' + RUN + '_' + SV + '_A', sbB = 'AT_SB_' + RUN + '_' + SV + '_B', sbAe = sbA + '_Edited'

// ---- Polls ----
def PL_T = ['Poll Question', 'Poll Title', 'Title']
def ansIn = { int idx, String v ->
    say('Nhap dap an ' + idx + ': ' + v)
    WebElement e = must("(//input[contains(@name,'answer') and @type='text'])[" + idx + "]", 'Dap an ' + idx)
    hl(e); e.clear(); e.sendKeys(v); Thread.sleep(PAUSE)
}
def createPoll = { String t, String status, List answers ->
    goGrid('Polls'); btn('Add')
    typeIn(PL_T, 'poll_title', t)
    sel(['Status'], 'closed', status)
    pickIdx(['Visible In'], 'store_ids', 0)
    if (answers.size() > 0) {
        goTab('Poll Answers')
        int i = 1
        answers.each { a -> btn('Add New Answer'); ansIn(i, a); i++ }
        goTab('Poll Information')
    }
    btn('Save')
}
String plA = 'AT_PL_' + RUN + '_' + SV + '_A', plB = 'AT_PL_' + RUN + '_' + SV + '_B', plAe = plA + '_Edited'

// ---- Widgets ----
def WG_T = ['Widget Instance Title', 'Title']
def createWidget = { String t, String sort, boolean withStore ->
    goGrid('Widgets'); btn('Add')
    sel(['Type'], 'instance_code', 'Orders and Returns')
    pickIdx(['Design Package'], 'theme_id', 1)
    btn('Continue'); Thread.sleep(1500)
    goTab('Frontend Properties')
    typeIn(WG_T, 'title', t)
    if (withStore) { pickIdx(['Assign to Store Views', 'Store View'], 'store_ids', 0) }
    typeIn(['Sort Order'], 'sort_order', sort)
    btn('Save')
}
String wgA = 'AT_WG_' + RUN + '_' + SV + '_A', wgB = 'AT_WG_' + RUN + '_' + SV + '_B', wgAe = wgA + '_Edited'

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

// ===================== 20 TEST: STATIC BLOCKS =====================
runTest('SB_01', 'Mo trang Static Blocks', { goGrid('Static Blocks'); check(btnPresent('Add', 8), 'Khong thay nut Add') })
runTest('SB_02', 'Nut Add mo form them block', { goGrid('Static Blocks'); btn('Add'); must(fieldXp(SB_T, 'block_title'), 'Form them block') })
runTest('SB_03', 'Them block hop le (Enabled)', { createBlock(sbA, sbA.toLowerCase(), 'Enabled', '<p>Noi dung</p>'); check(saved(), 'Khong co thong bao has been saved') })
runTest('SB_04', 'Block moi xuat hien o grid', { goGrid('Static Blocks'); filter('title', sbA); check(gridHas(sbA), 'Khong thay ' + sbA) })
runTest('SB_05', 'Them block Disabled', { createBlock(sbB, sbB.toLowerCase(), 'Disabled', '<p>B</p>'); check(saved(), 'Khong luu duoc') })
runTest('SB_06', 'Bo trong Title -> bao loi', { goGrid('Static Blocks'); btn('Add'); typeIn(SB_I, 'block_identifier', 'x_' + RUN); btn('Save'); check(blocked(), 'Khong bao loi') })
runTest('SB_07', 'Bo trong Identifier -> bao loi', { goGrid('Static Blocks'); btn('Add'); typeIn(SB_T, 'block_title', 'NoIdent_' + RUN); btn('Save'); check(blocked(), 'Khong bao loi') })
runTest('SB_08', 'Identifier trung -> bao loi', { createBlock('Dup_' + RUN, sbA.toLowerCase(), 'Enabled', 'dup'); check(blocked(), 'Khong bao loi trung') })
runTest('SB_09', 'Title co ky tu dac biet', { createBlock('AT_SB_' + RUN + '_!@#&', 'special_' + RUN, 'Enabled', 'sp'); check(saved(), 'Khong luu duoc') })
runTest('SB_10', 'Title dai 90 ky tu', { createBlock('AT_SB_' + RUN + '_' + ('L' * 80), 'long_' + RUN, 'Enabled', 'long'); check(saved(), 'Khong luu duoc') })
runTest('SB_11', 'Loc grid theo title (B)', { goGrid('Static Blocks'); filter('title', sbB); check(gridHas(sbB), 'Khong thay B') })
runTest('SB_12', 'Loc khong ton tai -> No records', { goGrid('Static Blocks'); filter('title', 'ZZZ_NOT_EXIST_999'); check(noRec(), 'Khong hien No records') })
runTest('SB_13', 'Nut Reset Filter', { goGrid('Static Blocks'); filter('title', 'ZZZ'); btn('Reset Filter'); Thread.sleep(1500); check(btnPresent('Add', 5), 'Mat grid') })
runTest('SB_14', 'Sua Title block A', { editBlock(sbA, { typeIn(SB_T, 'block_title', sbAe) }); check(saved(), 'Sua that bai') })
runTest('SB_15', 'Doi trang thai B sang Enabled', { editBlock(sbB, { sel(SB_S, 'block_is_active', 'Enabled') }); check(saved(), 'Sua that bai') })
runTest('SB_16', 'Sua noi dung block A', { editBlock(sbAe, { setContent('block_content', '<p>Da sua</p>') }); check(saved(), 'Sua that bai') })
runTest('SB_17', 'Nut Back tu form edit', { goGrid('Static Blocks'); filter('title', sbAe); openRow(sbAe); btn('Back'); check(btnPresent('Add', 8), 'Khong ve grid') })
runTest('SB_18', 'Xoa block A', { delItem('Static Blocks', 'title', sbAe); check(deleted(), 'Khong co has been deleted') })
runTest('SB_19', 'Xoa block B', { delItem('Static Blocks', 'title', sbB); check(deleted(), 'Khong co has been deleted') })
runTest('SB_20', 'Xac nhan A, B da bi xoa', { goGrid('Static Blocks'); filter('title', sbA); check(!gridHas(sbA), 'A van con'); filter('title', sbB); check(!gridHas(sbB), 'B van con') })

// ===================== 20 TEST: POLLS =====================
runTest('PL_01', 'Mo trang Polls', { goGrid('Polls'); check(btnPresent('Add', 8), 'Khong thay nut Add') })
runTest('PL_02', 'Nut Add mo form them poll', { goGrid('Polls'); btn('Add'); must(fieldXp(PL_T, 'poll_title'), 'Form them poll') })
runTest('PL_03', 'Them poll voi 2 dap an', { createPoll(plA, 'Open', ['Rat tot', 'Binh thuong']); check(saved(), 'Khong luu duoc') })
runTest('PL_04', 'Poll moi xuat hien o grid', { goGrid('Polls'); filter('poll_title', plA); check(gridHas(plA), 'Khong thay poll') })
runTest('PL_05', 'Them poll Closed', { createPoll(plB, 'Closed', ['Co', 'Khong']); check(saved(), 'Khong luu duoc') })
runTest('PL_06', 'Bo trong Title -> bao loi', { goGrid('Polls'); btn('Add'); btn('Save'); check(blocked(), 'Khong bao loi') })
runTest('PL_07', 'Poll khong co dap an -> bao loi', { createPoll('NoAns_' + RUN, 'Open', []); check(blocked(), 'Khong bao loi thieu dap an') })
runTest('PL_08', 'Title ky tu dac biet', { createPoll('AT_PL_' + RUN + '_!@#&', 'Open', ['A', 'B']); check(saved(), 'Khong luu duoc') })
runTest('PL_09', 'Title dai 90 ky tu', { createPoll('AT_PL_' + RUN + '_' + ('L' * 80), 'Open', ['A', 'B']); check(saved(), 'Khong luu duoc') })
runTest('PL_10', 'Poll voi 3 dap an', { createPoll('AT_PL_' + RUN + '_3ans', 'Open', ['A', 'B', 'C']); check(saved(), 'Khong luu duoc') })
runTest('PL_11', 'Loc grid theo title (B)', { goGrid('Polls'); filter('poll_title', plB); check(gridHas(plB), 'Khong thay B') })
runTest('PL_12', 'Loc khong ton tai -> No records', { goGrid('Polls'); filter('poll_title', 'ZZZ_NOT_EXIST_999'); check(noRec(), 'Khong hien No records') })
runTest('PL_13', 'Nut Reset Filter', { goGrid('Polls'); filter('poll_title', 'ZZZ'); btn('Reset Filter'); Thread.sleep(1500); check(btnPresent('Add', 5), 'Mat grid') })
runTest('PL_14', 'Sua Title poll A', { goGrid('Polls'); filter('poll_title', plA); openRow(plA); typeIn(PL_T, 'poll_title', plAe); btn('Save'); check(saved(), 'Sua that bai') })
runTest('PL_15', 'Doi poll B sang Open', { goGrid('Polls'); filter('poll_title', plB); openRow(plB); sel(['Status'], 'closed', 'Open'); btn('Save'); check(saved(), 'Sua that bai') })
runTest('PL_16', 'Sua dap an poll A', { goGrid('Polls'); filter('poll_title', plAe); openRow(plAe); goTab('Poll Answers'); ansIn(1, 'Rat hai long'); btn('Save'); check(saved(), 'Sua that bai') })
runTest('PL_17', 'Nut Back tu form edit', { goGrid('Polls'); filter('poll_title', plAe); openRow(plAe); btn('Back'); check(btnPresent('Add', 8), 'Khong ve grid') })
runTest('PL_18', 'Chuyen qua lai 2 tab', { goGrid('Polls'); filter('poll_title', plAe); openRow(plAe); goTab('Poll Answers'); must("//input[contains(@name,'answer')]", 'Tab Poll Answers'); goTab('Poll Information'); must(fieldXp(PL_T, 'poll_title'), 'Tab Poll Information') })
runTest('PL_19', 'Xoa poll A', { delItem('Polls', 'poll_title', plAe); check(deleted(), 'Khong co has been deleted') })
runTest('PL_20', 'Xoa poll B va xac nhan', { delItem('Polls', 'poll_title', plB); goGrid('Polls'); filter('poll_title', plB); check(!gridHas(plB), 'B van con') })

// ===================== 20 TEST: WIDGETS =====================
runTest('WG_01', 'Mo trang Widgets', { goGrid('Widgets'); check(btnPresent('Add', 8), 'Khong thay nut Add') })
runTest('WG_02', 'Nut Add mo form chon Type', { goGrid('Widgets'); btn('Add'); must(fieldXp(['Type'], 'instance_code'), 'O Type') })
runTest('WG_03', 'Co o chon Design Package', { goGrid('Widgets'); btn('Add'); must(fieldXp(['Design Package'], 'theme_id'), 'O Design Package') })
runTest('WG_04', 'Chon Type + Continue vao form chi tiet', { goGrid('Widgets'); btn('Add'); sel(['Type'], 'instance_code', 'Orders and Returns'); pickIdx(['Design Package'], 'theme_id', 1); btn('Continue'); must("//*[normalize-space(text())='Frontend Properties']", 'Tab Frontend Properties', 10) })
runTest('WG_05', 'Form co du cac tab', { goGrid('Widgets'); btn('Add'); sel(['Type'], 'instance_code', 'Orders and Returns'); pickIdx(['Design Package'], 'theme_id', 1); btn('Continue'); must("//*[normalize-space(text())='Frontend Properties']", 'Tab Frontend', 10); must("//*[normalize-space(text())='Widget Options']", 'Tab Widget Options') })
runTest('WG_06', 'Them widget hop le', { createWidget(wgA, '1', true); check(saved(), 'Khong luu duoc') })
runTest('WG_07', 'Widget moi xuat hien o grid', { goGrid('Widgets'); filter('title', wgA); check(gridHas(wgA), 'Khong thay widget') })
runTest('WG_08', 'Bo trong Title -> bao loi', { createWidget('', '1', true); check(blocked(), 'Khong bao loi') })
runTest('WG_09', 'Khong chon Store View -> bao loi', { createWidget('NoStore_' + RUN, '1', false); check(blocked(), 'Khong bao loi store') })
runTest('WG_10', 'Title ky tu dac biet', { createWidget('AT_WG_' + RUN + '_!@#&', '1', true); check(saved(), 'Khong luu duoc') })
runTest('WG_11', 'Title dai 90 ky tu', { createWidget('AT_WG_' + RUN + '_' + ('L' * 80), '1', true); check(saved(), 'Khong luu duoc') })
runTest('WG_12', 'Them widget thu 2 (sort order 5)', { createWidget(wgB, '5', true); check(saved(), 'Khong luu duoc') })
runTest('WG_13', 'Loc grid theo title', { goGrid('Widgets'); filter('title', wgB); check(gridHas(wgB), 'Khong thay B') })
runTest('WG_14', 'Loc khong ton tai -> No records', { goGrid('Widgets'); filter('title', 'ZZZ_NOT_EXIST_999'); check(noRec(), 'Khong hien No records') })
runTest('WG_15', 'Nut Reset Filter', { goGrid('Widgets'); filter('title', 'ZZZ'); btn('Reset Filter'); Thread.sleep(1500); check(btnPresent('Add', 5), 'Mat grid') })
runTest('WG_16', 'Sua Title widget A', { goGrid('Widgets'); filter('title', wgA); openRow(wgA); goTab('Frontend Properties'); typeIn(WG_T, 'title', wgAe); btn('Save'); check(saved(), 'Sua that bai') })
runTest('WG_17', 'Sua Sort Order widget B', { goGrid('Widgets'); filter('title', wgB); openRow(wgB); goTab('Frontend Properties'); typeIn(['Sort Order'], 'sort_order', '9'); btn('Save'); check(saved(), 'Sua that bai') })
runTest('WG_18', 'Chuyen qua lai cac tab khi sua', { goGrid('Widgets'); filter('title', wgAe); openRow(wgAe); goTab('Widget Options'); goTab('Frontend Properties'); must(fieldXp(WG_T, 'title'), 'Quay lai tab Frontend') })
runTest('WG_19', 'Xoa widget A', { delItem('Widgets', 'title', wgAe); check(deleted(), 'Khong co has been deleted') })
runTest('WG_20', 'Xoa widget B va xac nhan', { delItem('Widgets', 'title', wgB); goGrid('Widgets'); filter('title', wgB); check(!gridHas(wgB), 'B van con') })

// ===================== BAO CAO =====================
int pass = results.count { it[2] == 'PASS' }
int fail = results.size() - pass
File csv = new File(EVID + '/result_' + RUN + '.csv')
csv.text = 'ID,Name,Result,Reason\n' + results.collect { it.join(',') }.join('\n')
println('========== KET QUA: Tong ' + results.size() + ' | PASS ' + pass + ' | FAIL ' + fail + ' ==========')
results.each { println(it[0] + ' | ' + it[2] + ' | ' + it[1] + ' | ' + it[3]) }
println('CSV: ' + csv.absolutePath)
say('XONG: PASS ' + pass + ' / FAIL ' + fail)
Thread.sleep(3000)
WebUI.closeBrowser()
if (fail > 0) { KeywordUtil.markWarning('Con ' + fail + '/' + results.size() + ' test FAIL - xem Console/CSV') }