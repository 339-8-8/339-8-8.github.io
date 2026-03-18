// 应用状态
const state = {
    cases: casesData,
    filteredCases: casesData,
    selectedCase: null,
    selectedLevel: null,
    selectedSkin: null,
    wearValue: 0.35,
    pinnedCases: JSON.parse(localStorage.getItem('pinnedCases') || '[]'),
    searchQuery: ''
};

// 皮肤价格数据
// let skinPricesData = {};
let yyypPricesData = {};

// 当前版本号（每次更新时修改此值）
const APP_VERSION = '26.3.18.3';

// 更新公告内容
const UPDATE_NOTES = `
<h3>更新公告 v${APP_VERSION}</h3>
<ul>
    <li>第一次加载数据需要一点时间</li>
    <li>修改了页面布局，推荐在PC端使用，移动端只显示反向汰换</li>
    <li>反向汰换可以修改相似皮肤查找的磨损区间</li>
    <li>反向汰换模拟结果显示皮肤在悠悠有品的售价，仅作为炼金配方参考，不会经常更新</li>
    <li>由于buff和yyyp的皮肤名字一小部分有差异，会导致皮肤价格获取不到</li>
</ul>
<p class="update-tip">点击空白处或关闭按钮关闭此窗口</p>
`;

// 根据磨损值获取磨损等级名称
function getWearConditionName(wear) {
    if (wear > 0.45) return '战痕累累';
    if (wear > 0.38) return '破损不堪';
    if (wear > 0.15) return '久经沙场';
    if (wear > 0.07) return '略有磨损';
    return '崭新出厂';
}

// 查找皮肤价格
function getSkinPrice(skinName, wear) {
    if (!yyypPricesData || Object.keys(yyypPricesData).length === 0) {
        console.warn('YYYP价格数据未加载');
        return '-';
    }
    
    const conditionName = getWearConditionName(wear);
    
    // 尝试多种格式匹配
    const searchPatterns = [
        `${skinName} (${conditionName})`,  // 原始格式
        `${skinName.replace(/\s+/g, ' ')} (${conditionName})`,  // 标准化空格
        // 提取 | 后面的皮肤名称部分
        ...(skinName.includes('|') ? [
            `${skinName.split('|')[1].trim()} (${conditionName})`,
            `${skinName.split('|')[1].trim().replace(/\s+/g, ' ')} (${conditionName})`
        ] : [])
    ];
    
    // 在YYYP价格数据中查找
    for (const pattern of searchPatterns) {
        if (yyypPricesData[pattern]) {
            return yyypPricesData[pattern];
        }
    }
    
    // 调试：检查所有可能的键名
    console.log('未找到YYYP价格，尝试的格式:', searchPatterns);
    console.log('尝试查找包含皮肤名的键:');
    const normalizedSkinName = skinName.replace(/\s+/g, ' ');
    const skinNamePart = skinName.includes('|') ? skinName.split('|')[1].trim() : skinName;
    const matchingKeys = Object.keys(yyypPricesData).filter(key => 
        key.includes(normalizedSkinName) || 
        key.includes(skinName.replace(/\s+/g, '')) ||
        key.includes(skinNamePart)
    );
    if (matchingKeys.length > 0) {
        console.log('找到相关键:', matchingKeys.slice(0, 5));
    } else {
        console.log('未找到任何包含皮肤名的键');
    }
    
    return '-';
}

// 获取英文磨损等级
function getEnglishCondition(wear) {
    if (wear > 0.45) return 'Battle-Scared';
    if (wear > 0.38) return 'Well-Worn';
    if (wear > 0.15) return 'Field-Tested';
    if (wear > 0.07) return 'Minimal Wear';
    return 'Factory New';
}

// 皮肤级别顺序
const levelOrder = {
    '消费级': 1,
    '工业级': 2,
    '军规级': 3,
    '受限级': 4,
    '保密级': 5,
    '隐秘级': 6,
    '金色': 7
};

// DOM 元素
const elements = {
    searchInput: document.getElementById('searchInput'),
    caseList: document.getElementById('caseList'),
    levelSelect: document.getElementById('levelSelect'),
    skinSelect: document.getElementById('skinSelect'),
    wearInput: document.getElementById('wearInput'),
    wearRange: document.getElementById('wearRange'),
    calculateBtn: document.getElementById('calculateBtn'),
    resultsContainer: document.getElementById('resultsContainer')
};

// 初始化应用
function init() {
    // 更新加载进度
    updateLoadingProgress('正在初始化...');
    
    // 重新获取DOM元素，确保在DOM加载完成后
    elements.searchInput = document.getElementById('searchInput');
    elements.caseList = document.getElementById('caseList');
    elements.levelSelect = document.getElementById('levelSelect');
    elements.skinSelect = document.getElementById('skinSelect');
    elements.wearInput = document.getElementById('wearInput');
    elements.wearRange = document.getElementById('wearRange');
    elements.calculateBtn = document.getElementById('calculateBtn');
    elements.resultsContainer = document.getElementById('resultsContainer');
    
    // 检查是否所有必需的元素都存在
    if (!elements.levelSelect || !elements.caseList) {
        console.error('Required DOM elements not found');
        hideLoading();
        return;
    }
    
    // 加载皮肤价格数据
    loadSkinPrices();
    
    renderCaseList();
    setupEventListeners();
    checkUpdateNotes();
    
    // 默认选择第一个武器箱
    if (state.cases.length > 0) {
        selectCase(state.cases[0]);
    }
    
    // 隐藏加载提示
    hideLoading();
}

// 更新加载进度提示
function updateLoadingProgress(text) {
    const progressEl = document.getElementById('loadingProgress');
    if (progressEl) {
        progressEl.textContent = text;
    }
}

// 隐藏加载提示
function hideLoading() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
        setTimeout(() => {
            loadingOverlay.style.display = 'none';
        }, 300);
    }
}

// 加载皮肤价格数据
function loadSkinPrices() {
    updateLoadingProgress('正在加载价格数据...');
    
    let attempts = 0;
    const maxAttempts = 50;
    
    const checkData = () => {
        if (window.yyypPrices) {
            yyypPricesData = window.yyypPrices;
            console.log('YYYP价格数据加载成功，共', Object.keys(yyypPricesData).length, '条数据');
            updateLoadingProgress('价格数据加载完成');
        } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(checkData, 100);
        } else {
            console.warn('YYYP价格数据加载超时');
            updateLoadingProgress('价格数据加载超时，部分功能可能受限');
        }
    };
    
    checkData();
}

// 检查是否需要显示更新公告
function checkUpdateNotes() {
    const lastVersion = localStorage.getItem('appVersion');
    
    if (lastVersion !== APP_VERSION) {
        showUpdateNotes();
        localStorage.setItem('appVersion', APP_VERSION);
    }
}

// 显示更新公告
function showUpdateNotes() {
    const modal = document.getElementById('updateModal');
    const content = document.getElementById('updateModalContent');
    
    if (modal && content) {
        content.innerHTML = UPDATE_NOTES;
        modal.style.display = 'flex';
    }
}

// 关闭更新公告
function closeUpdateNotes() {
    const modal = document.getElementById('updateModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 切换页面
// 切换页面
window.switchPage = function(pageName) {
    // 更新按钮状态
    document.querySelectorAll('.sidebar-toggle-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.page === pageName) {
            btn.classList.add('active');
        }
    });
    
    // 切换页面显示
    document.querySelectorAll('.page-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

// 设置事件监听器
function setupEventListeners() {
    elements.searchInput.addEventListener('input', handleSearch);
    elements.wearInput.addEventListener('input', handleWearInput);
    elements.calculateBtn.addEventListener('click', calculateResults);
    
    // 皮肤级别下拉框
    elements.levelSelect.addEventListener('change', (e) => {
        if (e.target.value && state.selectedCase) {
            const level = state.selectedCase.levels.find(l => l.name === e.target.value);
            if (level) {
                selectLevel(level);
            }
        }
    });
    
    // 皮肤下拉框
    elements.skinSelect.addEventListener('change', (e) => {
        if (e.target.value && state.selectedLevel) {
            const skinId = parseInt(e.target.value);
            const skin = state.selectedLevel.skins.find(s => s.id === skinId);
            if (skin) {
                selectSkin(skin);
            }
        }
    });
    
    // 快速选择磨损值按钮
    document.querySelectorAll('.wear-quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const value = parseFloat(btn.dataset.value);
            state.wearValue = value;
            elements.wearInput.value = value.toFixed(3);
            handleWearInput();
        });
    });
    
    // 长按武器箱置顶
    let longPressTimer;
    elements.caseList.addEventListener('touchstart', (e) => {
        const caseItem = e.target.closest('.case-item');
        if (caseItem) {
            longPressTimer = setTimeout(() => {
                const caseId = parseInt(caseItem.dataset.id);
                togglePinCase(caseId);
                caseItem.style.transform = 'scale(1)';
            }, 500);
            caseItem.style.transform = 'scale(0.95)';
        }
    });
    
    elements.caseList.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimer);
        const caseItem = e.target.closest('.case-item');
        if (caseItem) {
            caseItem.style.transform = 'scale(1)';
        }
    });
    
    elements.caseList.addEventListener('touchmove', () => {
        clearTimeout(longPressTimer);
    });
    
    // 桌面端双击置顶（兼容性）
    elements.caseList.addEventListener('dblclick', (e) => {
        const caseItem = e.target.closest('.case-item');
        if (caseItem) {
            const caseId = parseInt(caseItem.dataset.id);
            togglePinCase(caseId);
        }
    });
}

// 渲染武器箱列表
function renderCaseList() {
    const sortedCases = [...state.filteredCases].sort((a, b) => {
        const aPinned = state.pinnedCases.includes(a.id);
        const bPinned = state.pinnedCases.includes(b.id);
        
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return 0;
    });

    elements.caseList.innerHTML = sortedCases.map(caseItem => `
        <div class="case-item ${state.selectedCase?.id === caseItem.id ? 'active' : ''} ${state.pinnedCases.includes(caseItem.id) ? 'pinned' : ''}" 
                data-id="${caseItem.id}" onclick="selectCase(${JSON.stringify(caseItem).replace(/"/g, '&quot;')})">
            <span class="case-name">${caseItem.name}</span>
            <button class="pin-btn" onclick="event.stopPropagation(); pinCase(${caseItem.id})" title="${state.pinnedCases.includes(caseItem.id) ? '取消置顶' : '点击置顶'}">${state.pinnedCases.includes(caseItem.id) ? '❌' : '📌'}</button>
        </div>
    `).join('');
}

// 渲染皮肤级别下拉框
function renderLevelList() {
    if (!state.selectedCase) {
        elements.levelSelect.innerHTML = '';
        return;
    }

    const levels = state.selectedCase.levels.sort((a, b) => 
        (levelOrder[a.name] || 99) - (levelOrder[b.name] || 99)
    );

    // 过滤掉当前最低级别（没有下级皮肤的级别）和金色级别
    const filteredLevels = levels.filter(level => {
        const currentOrder = levelOrder[level.name];
        const nextOrder = currentOrder - 1;
        return state.selectedCase.levels.some(l => levelOrder[l.name] === nextOrder);
    }).filter(level => level.name !== '金色');

    let html = filteredLevels.map(level => 
        `<option value="${level.name}" ${state.selectedLevel?.name === level.name ? 'selected' : ''}>${level.name}</option>`
    ).join('');
    
    elements.levelSelect.innerHTML = html;

    // 默认选择第一个级别
    if (filteredLevels.length > 0 && !state.selectedLevel) {
        selectLevel(filteredLevels[0]);
    }
}

// 渲染皮肤下拉框
function renderSkinList() {
    if (!state.selectedLevel) {
        elements.skinSelect.innerHTML = '';
        return;
    }

    let html = state.selectedLevel.skins.map(skin => 
        `<option value="${skin.id}" ${state.selectedSkin?.id === skin.id ? 'selected' : ''}>${skin.name}</option>`
    ).join('');
    
    elements.skinSelect.innerHTML = html;
    
    // 默认选择第一个皮肤
    if (state.selectedLevel.skins.length > 0 && !state.selectedSkin) {
        selectSkin(state.selectedLevel.skins[0]);
    }
}

// 选择武器箱
function selectCase(caseItem) {
    state.selectedCase = caseItem;
    state.selectedLevel = null;
    state.selectedSkin = null;
    
    renderCaseList();
    renderLevelList();
    renderSkinList();
    updateWearRange();
    clearResults();
}

// 选择皮肤级别
function selectLevel(level) {
    state.selectedLevel = level;
    state.selectedSkin = null;
    
    renderLevelList();
    renderSkinList();
    updateWearRange();
    clearResults();
}

// 选择皮肤
function selectSkin(skin) {
    state.selectedSkin = skin;
    
    renderSkinList();
    updateWearRange();
    clearResults();
    
    // 自动设置磨损值为0.150
    state.wearValue = 0.150;
    elements.wearInput.value = '0.150';
}

// 更新磨损值范围显示
function updateWearRange() {
    if (state.selectedSkin) {
        elements.wearRange.textContent = `磨损范围：${state.selectedSkin.minWear.toFixed(3)} ~ ${state.selectedSkin.maxWear.toFixed(3)}`;
        elements.wearRange.classList.remove('error');
    } else {
        elements.wearRange.textContent = '请先选择皮肤';
        elements.wearRange.classList.remove('error');
    }
}

// 处理搜索
function handleSearch(e) {
    state.searchQuery = e.target.value.toLowerCase();
    
    if (!state.searchQuery) {
        state.filteredCases = state.cases;
    } else {
        state.filteredCases = state.cases.filter(c => 
            c.name.toLowerCase().includes(state.searchQuery)
        );
    }
    
    renderCaseList();
}

// 处理磨损值输入
function handleWearInput(e) {
    const value = parseFloat(e.target.value);
    
    if (!isNaN(value)) {
        state.wearValue = Math.max(0, Math.min(1, value));
        
        // 验证磨损值范围
        if (state.selectedSkin) {
            const isValid = state.wearValue >= state.selectedSkin.minWear && 
                            state.wearValue <= state.selectedSkin.maxWear;
            
            elements.wearInput.classList.toggle('error', !isValid);
            elements.wearRange.classList.toggle('error', !isValid);
            
            if (!isValid) {
                elements.wearRange.textContent = `磨损值应在 ${state.selectedSkin.minWear.toFixed(3)} ~ ${state.selectedSkin.maxWear.toFixed(3)} 之间`;
            }
        }
    }
}

// 置顶/取消置顶武器箱
function togglePinCase(caseId) {
    const index = state.pinnedCases.indexOf(caseId);
    
    if (index > -1) {
        state.pinnedCases.splice(index, 1);
    } else {
        state.pinnedCases.push(caseId);
    }
    
    localStorage.setItem('pinnedCases', JSON.stringify(state.pinnedCases));
    renderCaseList();
    
    alert(state.pinnedCases.includes(caseId) ? '已置顶' : '已取消置顶');
}

// 点击置顶功能（切换模式）
function pinCase(caseId) {
    const index = state.pinnedCases.indexOf(caseId);
    
    if (index > -1) {
        // 如果已经置顶，则取消置顶
        state.pinnedCases.splice(index, 1);
    } else {
        // 如果未置顶，则置顶并移动到最前面
        state.pinnedCases.unshift(caseId);
    }
    
    localStorage.setItem('pinnedCases', JSON.stringify(state.pinnedCases));
    renderCaseList();
}

// 计算下级皮肤
function calculateResults() {
    if (!validateInput()) return;
    
    const currentOrder = levelOrder[state.selectedLevel.name];
    const nextOrder = currentOrder - 1;
    const nextLevel = state.selectedCase.levels.find(l => levelOrder[l.name] === nextOrder);
    
    if (!nextLevel) {
        showError('当前皮肤没有下级皮肤');
        return;
    }
    
    const results = nextLevel.skins.map(lowerSkin => {
        const lowerWear = calculateLowerWear(lowerSkin);
        const condition = getWearCondition(lowerWear);
        
        return {
            name: lowerSkin.name,
            wear: lowerWear,
            wearFormatted: lowerWear.toFixed(5),
            conditionCode: condition.code,
            conditionText: condition.text,
            conditionColor: condition.color
        };
    });
    
    results.sort((a, b) => a.wear - b.wear);
    
    // 更新当前最大磨损值显示
    const currentMaxWearSpan = document.getElementById('currentMaxWear');
    if (currentMaxWearSpan) {
        currentMaxWearSpan.textContent = state.selectedSkin.maxWear.toFixed(2);
    }
    
    // 重置区间输入框默认值
    const minIntervalInput = document.getElementById('minWearInterval');
    const maxIntervalInput = document.getElementById('maxWearInterval');
    if (minIntervalInput) minIntervalInput.value = state.selectedSkin.maxWear.toFixed(2);
    if (maxIntervalInput) maxIntervalInput.value = state.selectedSkin.maxWear.toFixed(2);
    
    displayResults(results);
}

// 查找相似皮肤（同级别、同磨损范围、有下级皮肤）
function findSimilarSkins(minMaxWear, maxMaxWear) {
    if (!state.selectedSkin || !state.selectedLevel) return [];
    
    const currentLevelName = state.selectedLevel.name;
    const currentOrder = levelOrder[currentLevelName];
    const nextOrder = currentOrder - 1;
    
    const similarSkins = [];
    
    // 遍历所有武器箱/收藏品
    for (const caseItem of state.cases) {
        // 找到同级别
        const sameLevel = caseItem.levels.find(l => l.name === currentLevelName);
        if (!sameLevel) continue;
        
        // 检查是否有下级皮肤
        const hasNextLevel = caseItem.levels.some(l => levelOrder[l.name] === nextOrder);
        if (!hasNextLevel) continue;
        
        // 遍历该级别的所有皮肤
        for (const skin of sameLevel.skins) {
            // 排除当前选择的皮肤
            if (skin.name === state.selectedSkin.name && caseItem.name === state.selectedCase.name) continue;
            
            // 检查最大磨损值是否在区间内
            if (skin.maxWear >= minMaxWear && skin.maxWear <= maxMaxWear) {
                similarSkins.push({
                    name: skin.name,
                    crate: caseItem.name,
                    minWear: skin.minWear,
                    maxWear: skin.maxWear,
                    isCurrent: false
                });
            }
        }
    }
    
    return similarSkins;
}

// 计算下级皮肤磨损值
function calculateLowerWear(lowerSkin) {
    const { selectedSkin, wearValue } = state;
    
    return lowerSkin.minWear +
        (lowerSkin.maxWear - lowerSkin.minWear) *
        (wearValue - selectedSkin.minWear) /
        (selectedSkin.maxWear - selectedSkin.minWear);
}

// 获取磨损状态和颜色
function getWearCondition(wear) {
    if (wear >= 0.45) {
        return { code: 'deep-red-brown', text: '战痕累累', color: '#8B4513' };
    } else if (wear >= 0.38) {
        return { code: 'red', text: '破损不堪', color: '#FF6B6B' };
    } else if (wear >= 0.15) {
        return { code: 'yellow', text: '久经沙场', color: '#FFD93D' };
    } else if (wear >= 0.07) {
        return { code: 'light-green', text: '略有磨损', color: '#6BCF7F' };
    } else {
        return { code: 'dark-green', text: '崭新出厂', color: '#2E8B57' };
    }
}

// 显示计算结果
function displayResults(results) {
    let html = '';
    
    // 1. 显示当前选中皮肤及同级别其他皮肤信息
    html += '<div class="result-section-title">📌 当前皮肤</div>';
    html += '<div class="current-skins-container">';
    
    // 当前选中皮肤
    const currentPrice = getSkinPrice(state.selectedSkin.name, state.wearValue);
    html += '<div class="current-skin-info">';
    html += `<span class="current-skin-name">${state.selectedSkin.name}</span>`;
    html += `<span class="current-skin-wear">${state.wearValue.toFixed(5)}</span>`;
    html += `<span class="current-skin-price">¥${currentPrice}</span>`;
    html += `<span class="current-skin-crate">${state.selectedCase.name}</span>`;
    html += '</div>';
    
    // 获取同武器箱同皮肤级别的其他皮肤
    if (state.selectedLevel && state.selectedLevel.skins.length > 1) {
        const otherSkinsInLevel = state.selectedLevel.skins.filter(s => s.name !== state.selectedSkin.name);
        
        if (otherSkinsInLevel.length > 0) {
            otherSkinsInLevel.forEach(skin => {
                // 其他同级皮肤磨损值 = (当前磨损值 - 当前最小磨损) / (当前最大磨损 - 当前最小磨损) * (其他皮肤最大磨损 - 其他皮肤最小磨损) + 其他皮肤最小磨损
                const otherWear = (state.wearValue - state.selectedSkin.minWear) / 
                                  (state.selectedSkin.maxWear - state.selectedSkin.minWear) * 
                                  (skin.maxWear - skin.minWear) + skin.minWear;
                const otherPrice = getSkinPrice(skin.name, otherWear);
                
                html += '<div class="current-skin-info other">';
                html += `<span class="current-skin-name">${skin.name}</span>`;
                html += `<span class="current-skin-wear">${otherWear.toFixed(5)}</span>`;
                html += `<span class="current-skin-price">¥${otherPrice}</span>`;
                html += `<span class="current-skin-crate">${state.selectedCase.name}</span>`;
                html += '</div>';
            });
        }
    }
    
    html += '</div>';
    
    // 2. 显示下级皮肤计算结果
    html += '<div class="result-section-title">📊 下级皮肤磨损值</div>';
    html += '<div class="result-list">';
    html += results.map(result => {
        const price = getSkinPrice(result.name, result.wear);
        return `
        <div class="result-card" style="border-left-color: ${result.conditionColor}">
            <div class="result-skin-name">${result.name}</div>
            <div class="result-wear">${result.wearFormatted}</div>
            <div class="result-price">¥${price}</div>
        </div>`;
    }).join('');
    html += '</div>';
    
    // 3. 相似皮肤查找区域
    const currentMaxWearValue = state.selectedSkin.maxWear.toFixed(2);
    html += '<div class="similar-search-section">';
    html += '<div class="similar-search-title">🔍 相似皮肤查找</div>';
    html += '<div class="similar-search-interval">';
    html += '<span class="interval-label">最大磨损值区间：</span>';
    html += '<div class="interval-inputs">';
    html += `<input type="number" class="interval-input" id="minWearInterval" placeholder="下限" min="0" max="${currentMaxWearValue}" step="0.01" value="${currentMaxWearValue}">`;
    html += '<span class="interval-separator">-</span>';
    html += `<span class="interval-current" id="currentMaxWear">${currentMaxWearValue}</span>`;
    html += '<span class="interval-separator">-</span>';
    html += `<input type="number" class="interval-input" id="maxWearInterval" placeholder="上限" min="${currentMaxWearValue}" max="1" step="0.01" value="${currentMaxWearValue}">`;
    html += '</div>';
    html += '</div>';
    html += '<button class="similar-search-btn" id="searchSimilarBtn">🔎 查找相似皮肤</button>';
    html += '</div>';
    
    // 4. 相似皮肤区域（初始为空，点击查找后填充）
    html += '<div class="result-section-title">🔗 相似皮肤</div>';
    html += '<div id="similarSkinsContainer">';
    html += '<div class="no-data">请点击"查找相似皮肤"按钮</div>';
    html += '</div>';
    
    // 5. 相似皮肤下级磨损值区域
    html += '<div class="result-section-title">📊 相似皮肤下级磨损值</div>';
    html += '<div id="similarWearContainer">';
    html += '<div class="no-data">请先选择相似皮肤</div>';
    html += '</div>';
    
    elements.resultsContainer.innerHTML = html;
    
    // 重新绑定查找按钮事件
    const searchBtn = document.getElementById('searchSimilarBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchAndDisplaySimilarSkins);
    }
    
    // 保存当前结果
    state.currentResults = results;
    state.similarSkins = [];
    state.selectedSimilarSkin = null;
}

// 查找并显示相似皮肤
function searchAndDisplaySimilarSkins() {
    const minInterval = parseFloat(document.getElementById('minWearInterval').value) || 0;
    const maxInterval = parseFloat(document.getElementById('maxWearInterval').value) || 0;
    
    const currentMaxWear = state.selectedSkin.maxWear;
    
    // 验证区间值
    if (minInterval < 0 || minInterval > currentMaxWear) {
        alert(`左侧区间值必须在 0 到 ${currentMaxWear.toFixed(2)} 之间`);
        return;
    }
    if (maxInterval < currentMaxWear || maxInterval > 1) {
        alert(`右侧区间值必须在 ${currentMaxWear.toFixed(2)} 到 1 之间`);
        return;
    }
    
    const similarSkins = findSimilarSkins(minInterval, maxInterval);
    state.similarSkins = similarSkins;
    
    const container = document.getElementById('similarSkinsContainer');
    if (!container) return;
    
    if (similarSkins.length === 0) {
        container.innerHTML = '<div class="no-data">未找到相似皮肤</div>';
        return;
    }
    
    let html = '<div class="similar-skins-grid">';
    similarSkins.forEach((skin, index) => {
        html += `<div class="similar-skin-card" onclick="selectSimilarSkin(${index})" data-index="${index}">`;
        html += `<div class="similar-skin-name">${skin.name}</div>`;
        html += `<div class="similar-skin-crate">${skin.crate}</div>`;
        html += `<div class="similar-skin-wear-range">磨损区间: ${skin.minWear.toFixed(2)} - ${skin.maxWear.toFixed(2)}</div>`;
        html += `</div>`;
    });
    html += '</div>';
    
    container.innerHTML = html;
    
    // 清空下级磨损值显示
    const wearContainer = document.getElementById('similarWearContainer');
    if (wearContainer) {
        wearContainer.innerHTML = '<div class="no-data">请选择相似皮肤查看下级磨损值</div>';
    }
}

// 选择相似皮肤并显示下级磨损值
function selectSimilarSkin(index) {
    if (!state.similarSkins || !state.similarSkins[index]) return;
    
    const similarSkin = state.similarSkins[index];
    state.selectedSimilarSkin = similarSkin;
    
    // 更新选中状态样式
    document.querySelectorAll('.similar-skin-card').forEach((card, i) => {
        card.classList.remove('selected');
        if (i === index) {
            card.classList.add('selected');
        }
    });
    
    // 找到相似皮肤对应的武器箱和皮肤数据
    const targetCase = state.cases.find(c => c.name === similarSkin.crate);
    if (!targetCase) return;
    
    const targetLevel = targetCase.levels.find(l => l.name === state.selectedLevel.name);
    if (!targetLevel) return;
    
    const targetSkin = targetLevel.skins.find(s => s.name === similarSkin.name);
    if (!targetSkin) return;
    
    // 计算该相似皮肤的下级皮肤磨损值
    const currentOrder = levelOrder[state.selectedLevel.name];
    const nextOrder = currentOrder - 1;
    const nextLevel = targetCase.levels.find(l => levelOrder[l.name] === nextOrder);
    
    if (!nextLevel) return;
    
    const results = nextLevel.skins.map(lowerSkin => {
        const lowerWear = calculateLowerWearForSkin(lowerSkin, targetSkin, state.wearValue);
        const condition = getWearCondition(lowerWear);
        
        return {
            name: lowerSkin.name,
            wear: lowerWear,
            wearFormatted: lowerWear.toFixed(5),
            conditionCode: condition.code,
            conditionText: condition.text,
            conditionColor: condition.color
        };
    });
    
    results.sort((a, b) => a.wear - b.wear);
    
    // 显示下级磨损值
    const wearContainer = document.getElementById('similarWearContainer');
    if (!wearContainer) return;
    
    let html = `<div class="selected-similar-info">`;
    html += `<span class="selected-similar-name">${targetSkin.name}</span>`;
    html += `<span class="selected-similar-crate">${targetCase.name}</span>`;
    html += `</div>`;
    html += '<div class="result-list">';
    results.forEach(result => {
        const price = getSkinPrice(result.name, result.wear);
        html += `<div class="result-card" style="border-left-color: ${result.conditionColor}">`;
        html += `<div class="result-skin-name">${result.name}</div>`;
        html += `<div class="result-wear">${result.wearFormatted}</div>`;
        html += `<div class="result-price">¥${price}</div>`;
        html += `</div>`;
    });
    html += '</div>';
    
    wearContainer.innerHTML = html;
}

// 为指定皮肤计算下级皮肤磨损值
function calculateLowerWearForSkin(lowerSkin, sourceSkin, wearValue) {
    return lowerSkin.minWear +
        (lowerSkin.maxWear - lowerSkin.minWear) *
        (wearValue - sourceSkin.minWear) /
        (sourceSkin.maxWear - sourceSkin.minWear);
}

// 验证输入
function validateInput() {
    if (!state.selectedCase) {
        showError('请先选择武器箱');
        return false;
    }
    
    if (!state.selectedLevel) {
        showError('请选择皮肤级别');
        return false;
    }
    
    if (!state.selectedSkin) {
        showError('请选择一个皮肤');
        return false;
    }
    
    if (isNaN(state.wearValue)) {
        showError('请输入有效的磨损值');
        return false;
    }
    
    if (state.wearValue < state.selectedSkin.minWear || state.wearValue > state.selectedSkin.maxWear) {
        showError(`磨损值应在 ${state.selectedSkin.minWear.toFixed(3)} ~ ${state.selectedSkin.maxWear.toFixed(3)} 之间`);
        return false;
    }
    
    return true;
}

// 显示错误信息
function showError(message) {
    elements.resultsContainer.innerHTML = `<div class="no-data" style="color: #f56565;">${message}</div>`;
}

// 清除结果
function clearResults() {
    elements.resultsContainer.innerHTML = '<div class="no-data">请完成以上步骤后查看计算结果</div>';
}

// 启动应用
document.addEventListener('DOMContentLoaded', init);