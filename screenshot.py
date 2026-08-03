from playwright.sync_api import sync_playwright
import time
import os
import json

BASE_URL = "http://127.0.0.1:7301"
OUTPUT_DIR = r"C:\Users\huawe\Documents\Kimi\Workspaces\CRF设计\crf-designer\screenshots"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 预设的演示数据
DEMO_DATA = {
    "currentUser": {"id":"user_admin_demo","username":"admin","name":"后台管理员","role":"admin","createdAt":"2026-08-01T00:00:00Z","updatedAt":"2026-08-01T00:00:00Z","isActive":True},
    "projects": [
        {
            "id": "proj_001",
            "projectNo": "CN101CLCT06",
            "name": "软坚清脉法治疗下肢动脉硬化闭塞症的多中心临床研究",
            "description": "评估软坚清脉法治疗下肢动脉硬化闭塞症的疗效和安全性",
            "status": "study_started",
            "sponsor": "上海瑞金医院",
            "principalInvestigator": "张慈",
            "researchCenter": "上海瑞金医院",
            "department": "内分泌科",
            "startDate": "2026-01-15",
            "endDate": "2026-12-31",
            "targetEnrollment": 120,
            "visits": [
                {"id":"v1","projectId":"proj_001","name":"筛选访视","code":"V0","order":0,"crfModuleIds":["m1","m2"]},
                {"id":"v2","projectId":"proj_001","name":"基线访视","code":"V1","order":1,"crfModuleIds":["m1","m2","m3"]},
            ],
            "crfModules": [
                {"id":"m1","projectId":"proj_001","name":"人口学特征","description":"","fields":[
                    {"id":"f1","type":"text","label":"姓名","name":"name","order":0},
                    {"id":"f2","type":"select","label":"性别","name":"gender","order":1,"options":[{"label":"男","value":"male"},{"label":"女","value":"female"}]},
                ]},
                {"id":"m2","projectId":"proj_001","name":"生命体征","description":"","fields":[
                    {"id":"f4","type":"number","label":"收缩压(mmHg)","name":"sbp","order":0},
                ]},
                {"id":"m3","projectId":"proj_001","name":"实验室检查","description":"","fields":[
                    {"id":"f7","type":"number","label":"总胆固醇","name":"tc","order":0},
                ]},
            ],
            "patients": [],
            "visitData": {},
            "createdAt": "2026-01-01T00:00:00Z",
            "updatedAt": "2026-08-01T00:00:00Z",
        },
        {
            "id": "proj_002",
            "projectNo": "CN102CLCT11",
            "name": "新型GLP-1受体激动剂治疗2型糖尿病的III期临床研究",
            "description": "评估新型GLP-1受体激动剂治疗2型糖尿病的疗效和安全性",
            "status": "study_started",
            "sponsor": "海和药物",
            "principalInvestigator": "张慈",
            "researchCenter": "上海瑞金医院",
            "department": "内分泌科",
            "startDate": "2026-03-01",
            "endDate": "2027-02-28",
            "targetEnrollment": 200,
            "visits": [],
            "crfModules": [],
            "patients": [],
            "visitData": {},
            "createdAt": "2026-03-01T00:00:00Z",
            "updatedAt": "2026-08-01T00:00:00Z",
        },
        {
            "id": "proj_003",
            "projectNo": "CN103CLCT15",
            "name": "PD-1抑制剂联合化疗治疗晚期肺癌的临床研究",
            "description": "评估PD-1抑制剂联合化疗治疗晚期肺癌的疗效和安全性",
            "status": "proposal_review",
            "sponsor": "信达生物",
            "principalInvestigator": "李华",
            "researchCenter": "北京协和医院",
            "department": "肿瘤科",
            "targetEnrollment": 80,
            "visits": [],
            "crfModules": [],
            "patients": [],
            "visitData": {},
            "createdAt": "2026-05-01T00:00:00Z",
            "updatedAt": "2026-08-01T00:00:00Z",
        },
        {
            "id": "proj_004",
            "projectNo": "CN104CLCT20",
            "name": "重组人胰岛素类似物治疗1型糖尿病的临床研究",
            "description": "评估重组人胰岛素类似物治疗1型糖尿病的疗效和安全性",
            "status": "contract_signed",
            "sponsor": "甘李药业",
            "principalInvestigator": "王强",
            "researchCenter": "华西医院",
            "department": "内分泌科",
            "targetEnrollment": 150,
            "visits": [],
            "crfModules": [],
            "patients": [],
            "visitData": {},
            "createdAt": "2026-04-01T00:00:00Z",
            "updatedAt": "2026-08-01T00:00:00Z",
        },
        {
            "id": "proj_005",
            "projectNo": "CN105CLCT25",
            "name": "CAR-T细胞治疗复发难治性B细胞淋巴瘤的临床研究",
            "description": "评估CAR-T细胞治疗复发难治性B细胞淋巴瘤的疗效和安全性",
            "status": "ethics_review",
            "sponsor": "复星凯特",
            "principalInvestigator": "陈明",
            "researchCenter": "上海长征医院",
            "department": "血液科",
            "targetEnrollment": 60,
            "visits": [],
            "crfModules": [],
            "patients": [],
            "visitData": {},
            "createdAt": "2026-06-01T00:00:00Z",
            "updatedAt": "2026-08-01T00:00:00Z",
        },
        {
            "id": "proj_006",
            "projectNo": "CN106CLCT30",
            "name": "抗VEGF单抗治疗湿性年龄相关性黄斑变性的临床研究",
            "description": "评估抗VEGF单抗治疗湿性年龄相关性黄斑变性的疗效和安全性",
            "status": "study_closed",
            "sponsor": "康弘药业",
            "principalInvestigator": "刘芳",
            "researchCenter": "中山大学眼科中心",
            "department": "眼科",
            "targetEnrollment": 100,
            "visits": [],
            "crfModules": [],
            "patients": [],
            "visitData": {},
            "createdAt": "2025-01-01T00:00:00Z",
            "updatedAt": "2026-07-01T00:00:00Z",
        },
        {
            "id": "proj_007",
            "projectNo": "CN107CLCT35",
            "name": "SGLT-2抑制剂联合二甲双胍治疗2型糖尿病的临床研究",
            "description": "评估SGLT-2抑制剂联合二甲双胍治疗2型糖尿病的疗效和安全性",
            "status": "proposal_review",
            "sponsor": "阿斯利康",
            "principalInvestigator": "赵敏",
            "researchCenter": "瑞金医院",
            "department": "内分泌科",
            "targetEnrollment": 180,
            "visits": [],
            "crfModules": [],
            "patients": [],
            "visitData": {},
            "createdAt": "2026-07-01T00:00:00Z",
            "updatedAt": "2026-08-01T00:00:00Z",
        },
        {
            "id": "proj_008",
            "projectNo": "CN108CLCT40",
            "name": "抗体偶联药物治疗HER2阳性晚期乳腺癌的临床研究",
            "description": "评估抗体偶联药物治疗HER2阳性晚期乳腺癌的疗效和安全性",
            "status": "contract_signed",
            "sponsor": "荣昌生物",
            "principalInvestigator": "孙丽",
            "researchCenter": "复旦大学附属肿瘤医院",
            "department": "肿瘤内科",
            "targetEnrollment": 90,
            "visits": [],
            "crfModules": [],
            "patients": [],
            "visitData": {},
            "createdAt": "2026-02-01T00:00:00Z",
            "updatedAt": "2026-08-01T00:00:00Z",
        },
    ],
    "users": [
        {"id":"u1","username":"manager1","name":"管理用户","role":"manager","isActive":True,"createdAt":"2026-01-01T00:00:00Z"},
        {"id":"u2","username":"entry1","name":"录入员小王","role":"data_entry","isActive":True,"createdAt":"2026-01-01T00:00:00Z"},
    ],
    "moduleLibrary": [
        {"id":"lib1","name":"人口学特征","category":"基础信息","description":"受试者基本人口学信息","isSystem":True,"fields":[
            {"id":"lf1","type":"text","label":"姓名","name":"name","order":0},
            {"id":"lf2","type":"select","label":"性别","name":"gender","order":1,"options":[{"label":"男","value":"male"},{"label":"女","value":"female"}]},
            {"id":"lf3","type":"date","label":"出生日期","name":"birthDate","order":2},
            {"id":"lf4","type":"select","label":"民族","name":"ethnicity","order":3,"options":[{"label":"汉族","value":"han"},{"label":"满族","value":"man"},{"label":"蒙古族","value":"mongol"},{"label":"回族","value":"hui"},{"label":"藏族","value":"tibetan"},{"label":"维吾尔族","value":"uyghur"},{"label":"其他","value":"other"}]},
            {"id":"lf5","type":"number","label":"身高(cm)","name":"height","order":4},
            {"id":"lf6","type":"number","label":"体重(kg)","name":"weight","order":5},
            {"id":"lf7","type":"number","label":"BMI","name":"bmi","order":6},
        ],"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"},
        {"id":"lib2","name":"生命体征","category":"检查","description":"常规生命体征测量","isSystem":True,"fields":[
            {"id":"lf8","type":"number","label":"收缩压(mmHg)","name":"sbp","order":0},
            {"id":"lf9","type":"number","label":"舒张压(mmHg)","name":"dbp","order":1},
            {"id":"lf10","type":"number","label":"心率(次/分)","name":"hr","order":2},
            {"id":"lf11","type":"number","label":"呼吸频率(次/分)","name":"rr","order":3},
            {"id":"lf12","type":"number","label":"体温(°C)","name":"temp","order":4},
        ],"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"},
        {"id":"lib3","name":"实验室检查","category":"检查","description":"常规实验室检验项目","isSystem":True,"fields":[
            {"id":"lf13","type":"number","label":"白细胞计数","name":"wbc","order":0},
            {"id":"lf14","type":"number","label":"红细胞计数","name":"rbc","order":1},
            {"id":"lf15","type":"number","label":"血红蛋白","name":"hgb","order":2},
            {"id":"lf16","type":"number","label":"血小板","name":"plt","order":3},
            {"id":"lf17","type":"number","label":"总胆固醇","name":"tc","order":4},
        ],"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"},
        {"id":"lib4","name":"病史采集","category":"基础信息","description":"既往病史及相关信息采集","isSystem":True,"fields":[
            {"id":"lf18","type":"textarea","label":"既往病史","name":"pmh","order":0},
            {"id":"lf19","type":"textarea","label":"过敏史","name":"allergy","order":1},
            {"id":"lf20","type":"textarea","label":"家族史","name":"fh","order":2},
            {"id":"lf21","type":"checkbox","label":"合并疾病","name":"comorbidity","order":3,"options":[{"label":"高血压","value":"htn"},{"label":"糖尿病","value":"dm"},{"label":"高脂血症","value":"hlp"},{"label":"冠心病","value":"cad"}]},
        ],"createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z"},
    ],
}

DEMO_JSON = json.dumps(DEMO_DATA)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="msedge")
    context = browser.new_context(viewport={"width": 1440, "height": 900})

    page = context.new_page()

    # 应用首次加载会自动写入内置演示数据（版本号不匹配时自动重置）
    page.goto(BASE_URL, timeout=60000)
    page.wait_for_load_state("networkidle")
    page.evaluate('localStorage.removeItem("clini_x_rdms_data"); localStorage.removeItem("clini_x_rdms_version")')
    page.goto(BASE_URL, timeout=60000)
    page.wait_for_load_state("networkidle")

    # 1. 登录页
    page.goto(f"{BASE_URL}/login", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "1-login.png"), full_page=False)
    print("截图: 1-login.png")

    # 2. 管理人员端首页
    page.evaluate('''() => {
        const data = JSON.parse(localStorage.getItem("clini_x_rdms_data") || "{}");
        data.currentUser = data.currentUser || {};
        data.currentUser.role = "manager";
        data.currentUser.name = "管理用户";
        localStorage.setItem("clini_x_rdms_data", JSON.stringify(data));
    }''')
    page.goto(f"{BASE_URL}/manager", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "2-manager.png"), full_page=False)
    print("截图: 2-manager.png")

    # 3. 管理人员端项目管理（新统计卡片）
    page.goto(f"{BASE_URL}/manager/projects", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "3-manager-projects.png"), full_page=False)
    print("截图: 3-manager-projects.png")

    # 4. 后台管理端首页
    page.evaluate('''() => {
        const data = JSON.parse(localStorage.getItem("clini_x_rdms_data") || "{}");
        data.currentUser = data.currentUser || {};
        data.currentUser.role = "admin";
        data.currentUser.name = "后台管理员";
        localStorage.setItem("clini_x_rdms_data", JSON.stringify(data));
    }''')
    page.goto(f"{BASE_URL}/admin", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "4-admin-home.png"), full_page=False)
    print("截图: 4-admin-home.png")

    # 5. 模块库页面（展示置顶效果）
    page.goto(f"{BASE_URL}/admin/module-library", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    page.click("text=人口学特征", timeout=5000)
    time.sleep(2)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "5-admin-module-library.png"), full_page=False)
    print("截图: 5-admin-module-library.png")

    # 6. CRF设计器页面
    page.goto(f"{BASE_URL}/admin/crf-designer", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(2)
    page.click("[role=combobox]", timeout=5000)
    time.sleep(0.5)
    page.click("text=CN101CLCT06", timeout=5000)
    time.sleep(2)
    page.click("text=筛选访视", timeout=5000)
    time.sleep(1)
    page.click("text=人口学特征", timeout=5000)
    time.sleep(2)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "6-admin-crf-designer.png"), full_page=False)
    print("截图: 6-admin-crf-designer.png")

    # 7. 数据录入端首页
    page.evaluate('''() => {
        const data = JSON.parse(localStorage.getItem("clini_x_rdms_data") || "{}");
        data.currentUser = data.currentUser || {};
        data.currentUser.role = "data_entry";
        data.currentUser.name = "录入员";
        localStorage.setItem("clini_x_rdms_data", JSON.stringify(data));
    }''')
    page.goto(f"{BASE_URL}/entry", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(3)
    page.screenshot(path=os.path.join(OUTPUT_DIR, "7-entry.png"), full_page=False)
    print("截图: 7-entry.png")

    browser.close()
    print("所有截图完成!")
