/**
 * TDCC 股東會自動投票 - Auto.js 腳本
 * 
 * 使用方式：
 * 1. 安裝 Auto.js Pro 或 Hamibot
 * 2. 開啟無障礙服務權限
 * 3. 在手機瀏覽器登入 TDCC 股東e服務，進入投票清單頁
 * 4. 執行此腳本
 * 
 * 功能：
 * - 自動抓取未投票清單
 * - 讓你選擇要投哪些
 * - 全部棄權投票
 * - 自動截圖存檔
 */

"auto";

// ============ 設定區 ============
var SCREENSHOT_DIR = "/sdcard/Pictures/投票截圖/";
var WAIT_TIMEOUT = 8000;    // 等待元素出現的超時（毫秒）
var CLICK_DELAY = 1500;     // 每次點擊後等待（毫秒）
var PAGE_DELAY = 3000;      // 換頁後等待（毫秒）
// ================================

// 確保截圖資料夾存在
files.ensureDir(SCREENSHOT_DIR);

// 請求截圖權限
if (!requestScreenCapture()) {
    toast("需要截圖權限！");
    exit();
}

/**
 * 等待文字出現在畫面上
 */
function waitForText(text, timeout) {
    timeout = timeout || WAIT_TIMEOUT;
    var end = Date.now() + timeout;
    while (Date.now() < end) {
        if (textContains(text).exists()) return true;
        sleep(500);
    }
    return false;
}

/**
 * 安全點擊包含指定文字的元素
 */
function clickText(text, retries) {
    retries = retries || 3;
    for (var i = 0; i < retries; i++) {
        var elem = textContains(text).findOne(2000);
        if (elem) {
            elem.click();
            sleep(CLICK_DELAY);
            return true;
        }
        // 嘗試用座標點擊
        var elem2 = textContains(text).findOne(1000);
        if (elem2) {
            var b = elem2.bounds();
            click(b.centerX(), b.centerY());
            sleep(CLICK_DELAY);
            return true;
        }
        sleep(500);
    }
    return false;
}

/**
 * 安全點擊精確匹配的文字元素
 */
function clickExactText(text, retries) {
    retries = retries || 3;
    for (var i = 0; i < retries; i++) {
        var elem = text(text).findOne(2000);
        if (elem) {
            elem.click();
            sleep(CLICK_DELAY);
            return true;
        }
        var elem2 = text(text).findOne(1000);
        if (elem2) {
            var b = elem2.bounds();
            click(b.centerX(), b.centerY());
            sleep(CLICK_DELAY);
            return true;
        }
        sleep(500);
    }
    return false;
}

/**
 * 在搜尋框輸入代號並查詢
 */
function searchStock(code) {
    log("搜尋：" + code);
    
    // 找輸入框
    var input = className("EditText").findOne(3000);
    if (!input) {
        // 嘗試找 input 欄位
        input = className("android.widget.EditText").findOne(3000);
    }
    if (!input) {
        log("找不到搜尋框");
        return false;
    }
    
    // 清空並輸入
    input.click();
    sleep(500);
    input.setText(code);
    sleep(500);
    
    // 點查詢按鈕（頁面上方的，不是表格內的）
    // 先找在輸入框附近的「查詢」
    var queryBtns = textContains("查詢").find();
    if (queryBtns.length > 0) {
        // 點第一個（通常是搜尋按鈕）
        var btn = queryBtns[0];
        btn.click();
        sleep(CLICK_DELAY);
    }
    
    sleep(PAGE_DELAY);
    return true;
}

/**
 * 對當前頁面執行棄權
 */
function abstainCurrentPage() {
    // 1. 先找「全部棄權」連結
    var abstainLinks = textContains("全部棄權").find();
    if (abstainLinks.length > 0) {
        for (var i = 0; i < abstainLinks.length; i++) {
            abstainLinks[i].click();
            sleep(800);
        }
        log("  點選全部棄權");
        return;
    }
    
    // 2. 找「棄權」radio button 文字
    var abstainRadios = text("棄權").find();
    if (abstainRadios.length > 0) {
        for (var i = 0; i < abstainRadios.length; i++) {
            abstainRadios[i].click();
            sleep(300);
        }
        log("  選擇棄權 x" + abstainRadios.length);
    }
}

/**
 * 處理彈窗（「尚有X選舉權數未行使」等）
 */
function handlePopup() {
    sleep(1000);
    
    // 找「選舉權數未行使」相關的彈窗
    if (textContains("未行使").exists() || textContains("選舉權數").exists()) {
        log("  偵測到選舉權數彈窗");
        // 找彈窗裡的「下一步」
        var nextBtns = text("下一步").find();
        if (nextBtns.length > 0) {
            // 如果有多個「下一步」，點最上面的那個（彈窗裡的）
            for (var i = 0; i < nextBtns.length; i++) {
                var btn = nextBtns[i];
                var b = btn.bounds();
                // 彈窗通常在螢幕中間
                if (b.centerY() < device.height * 0.7) {
                    btn.click();
                    sleep(CLICK_DELAY);
                    log("  點彈窗下一步");
                    return true;
                }
            }
            // 都沒找到合適的，點第一個
            nextBtns[0].click();
            sleep(CLICK_DELAY);
            return true;
        }
    }
    return false;
}

/**
 * 多步驟投票流程
 */
function voteOneStock(code) {
    log("\n▶ 投票：" + code);
    
    // 搜尋該股票
    searchStock(code);
    
    // 點「投票」連結
    if (!clickExactText("投票")) {
        log("  ✗ 找不到投票按鈕");
        return false;
    }
    sleep(PAGE_DELAY);
    
    // 多步驟投票
    var maxSteps = 10;
    var lastPage = "";
    var samePageCount = 0;
    
    for (var step = 1; step <= maxSteps; step++) {
        log("  步驟" + step);
        
        // 偵測重複頁面（卡住）
        var currentPage = "";
        try {
            // 用頁面上的文字來判斷是否換頁了
            var bodyTexts = className("android.view.View").find();
            if (bodyTexts.length > 0) {
                currentPage = bodyTexts[0].text() || "";
            }
        } catch(e) { }
        
        if (currentPage === lastPage && currentPage !== "") {
            samePageCount++;
            if (samePageCount >= 2) {
                // 卡住了，嘗試處理彈窗
                if (!handlePopup()) {
                    log("  ⚠ 卡住了");
                    break;
                }
                samePageCount = 0;
                continue;
            }
        } else {
            samePageCount = 0;
        }
        lastPage = currentPage;
        
        // 先處理彈窗
        handlePopup();
        
        // 檢查是否到確認頁
        if (textContains("確認投票結果").exists()) {
            log("  → 確認投票結果");
            clickText("確認投票結果");
            sleep(PAGE_DELAY);
            
            // 截圖
            takeVoteScreenshot(code);
            return true;
        }
        
        // 棄權當前頁面
        abstainCurrentPage();
        
        // 找「下一步」
        if (text("下一步").exists()) {
            log("  → 下一步");
            clickExactText("下一步");
            sleep(PAGE_DELAY);
            
            // 處理可能的彈窗
            handlePopup();
            continue;
        }
        
        // 找「確認」等按鈕
        if (textContains("確認送出").exists()) {
            clickText("確認送出");
            sleep(PAGE_DELAY);
            takeVoteScreenshot(code);
            return true;
        }
        
        log("  ⚠ 找不到下一步");
        break;
    }
    
    return false;
}

/**
 * 截圖（投票完成後，搜尋代號點查詢看有條碼的頁面）
 */
function takeVoteScreenshot(code) {
    log("  準備截圖...");
    sleep(2000);
    
    // 回到清單頁
    back();
    sleep(PAGE_DELAY);
    
    // 搜尋代號
    searchStock(code);
    
    // 點「查詢」連結
    var queryLinks = text("查詢").find();
    // 找表格裡的查詢（不是搜尋按鈕）
    for (var i = 0; i < queryLinks.length; i++) {
        var link = queryLinks[i];
        var b = link.bounds();
        // 表格裡的查詢通常在頁面中下方
        if (b.centerY() > device.height * 0.3) {
            link.click();
            sleep(PAGE_DELAY);
            break;
        }
    }
    
    // 等待條碼頁面載入
    sleep(3000);
    
    // 截圖
    var ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
    var filename = SCREENSHOT_DIR + code + "_" + ts + ".png";
    
    var img = captureScreen();
    if (img) {
        img.saveTo(filename);
        log("  ✓ 截圖：" + filename);
    }
    
    // 按返回回到清單
    back();
    sleep(2000);
}

/**
 * 抓取未投票清單
 */
function getUnvotedList() {
    log("\n抓取未投票清單...");
    
    // 先點「未投票」篩選
    clickExactText("未投票");
    sleep(PAGE_DELAY);
    
    var stocks = [];
    
    // 找所有包含數字代號的文字（4位數字）
    var allTexts = className("android.view.View").find();
    for (var i = 0; i < allTexts.length; i++) {
        var t = allTexts[i].text();
        if (t && /^\d{4}$/.test(t.trim())) {
            stocks.push(t.trim());
        }
    }
    
    // 去重
    var unique = [];
    var seen = {};
    for (var i = 0; i < stocks.length; i++) {
        if (!seen[stocks[i]]) {
            seen[stocks[i]] = true;
            unique.push(stocks[i]);
        }
    }
    
    log("找到 " + unique.length + " 檔未投票");
    return unique;
}

// ============ 主程式 ============
function main() {
    toast("TDCC 自動投票啟動");
    log("=".repeat(40));
    log("  TDCC 股東會自動投票（Auto.js）");
    log("=".repeat(40));
    
    // 確認已在 TDCC 頁面
    if (!waitForText("投票", 5000) && !waitForText("股東", 5000)) {
        alert("請先開啟 TDCC 投票清單頁面！");
        exit();
    }
    
    // 方式選擇
    var mode = dialogs.select("投票方式", [
        "自動抓取未投票清單",
        "手動輸入代號"
    ]);
    
    var stockCodes = [];
    
    if (mode === 0) {
        // 自動抓取
        stockCodes = getUnvotedList();
        if (stockCodes.length === 0) {
            alert("沒有找到未投票的股票！\n請確認在投票清單頁面。");
            exit();
        }
        
        // 讓使用者選擇
        var choices = dialogs.multiChoice("選擇要投票的股票（全部棄權）", stockCodes, 
            // 預設全選
            (function() { var a = []; for(var i = 0; i < stockCodes.length; i++) a.push(i); return a; })()
        );
        
        if (!choices || choices.length === 0) {
            toast("未選擇，結束");
            exit();
        }
        
        var selected = [];
        for (var i = 0; i < choices.length; i++) {
            selected.push(stockCodes[choices[i]]);
        }
        stockCodes = selected;
        
    } else {
        // 手動輸入
        var input = dialogs.rawInput("輸入股票代號（逗號分隔）", "1536,1582,1904");
        if (!input) exit();
        stockCodes = input.split(",").map(function(s) { return s.trim(); });
    }
    
    // 確認
    var confirmMsg = "將對以下 " + stockCodes.length + " 檔棄權投票：\n" + stockCodes.join(", ");
    if (!dialogs.confirm("確認投票", confirmMsg)) {
        toast("已取消");
        exit();
    }
    
    // 開始投票
    var results = [];
    for (var i = 0; i < stockCodes.length; i++) {
        var code = stockCodes[i];
        log("\n[" + (i + 1) + "/" + stockCodes.length + "]");
        
        var success = voteOneStock(code);
        results.push({ code: code, success: success });
        
        sleep(1000);
    }
    
    // 結果
    log("\n" + "=".repeat(40));
    var okCount = results.filter(function(r) { return r.success; }).length;
    log("完成！成功 " + okCount + "/" + results.length);
    
    var resultMsg = "投票完成！\n成功：" + okCount + "/" + results.length + "\n\n";
    for (var i = 0; i < results.length; i++) {
        var r = results[i];
        resultMsg += (r.success ? "✓ " : "✗ ") + r.code + "\n";
    }
    resultMsg += "\n截圖存放：" + SCREENSHOT_DIR;
    
    alert("完成", resultMsg);
    
    // 存記錄
    var logPath = SCREENSHOT_DIR + "記錄_" + new Date().toISOString().substring(0, 10) + ".json";
    files.write(logPath, JSON.stringify(results, null, 2));
}

main();