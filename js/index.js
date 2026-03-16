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

// 当前版本号（每次更新时修改此值）
const APP_VERSION = '26.3.16.2';

// 更新公告内容
const UPDATE_NOTES = `
<h3>更新公告 v${APP_VERSION}</h3>
<ul>
    <li>粗略修改了页面布局</li>
    <li>反向汰换可以查看磨损区间相似的皮肤数据</li>
</ul>
<p class="update-tip">点击空白处或关闭按钮关闭此窗口</p>
`;

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
        return;
    }
    
    renderCaseList();
    setupEventListeners();
    checkUpdateNotes();
    
    // 默认选择第一个武器箱
    if (state.cases.length > 0) {
        selectCase(state.cases[0]);
    }
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
    
    // 查找相似皮肤（同级别、同磨损范围）
    const similarSkins = findSimilarSkins();
    
    displayResults(results, similarSkins);
}

// 查找相似皮肤（同级别、同磨损范围、有下级皮肤）
function findSimilarSkins() {
    if (!state.selectedSkin || !state.selectedLevel) return [];
    
    const currentMinWear = state.selectedSkin.minWear;
    const currentMaxWear = state.selectedSkin.maxWear;
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
            
            // 检查磨损范围是否相同
            if (skin.minWear === currentMinWear && skin.maxWear === currentMaxWear) {
                similarSkins.push({
                    name: skin.name,
                    crate: caseItem.name,
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
function displayResults(results, similarSkins) {
    let html = '';
    
    // 1. 显示当前选中皮肤信息
    html += '<div class="result-section-title">📌 当前皮肤</div>';
    html += '<div class="current-skin-info">';
    html += `<span class="current-skin-name">${state.selectedSkin.name}</span>`;
    html += `<span class="current-skin-wear">${state.wearValue.toFixed(5)}</span>`;
    html += `<span class="current-skin-crate">${state.selectedCase.name}</span>`;
    html += '</div>';
    
    // 2. 显示下级皮肤计算结果
    html += '<div class="result-section-title">📊 下级皮肤磨损值</div>';
    html += '<div class="result-list">';
    html += results.map(result => `
        <div class="result-card" style="border-left-color: ${result.conditionColor}">
            <div class="result-skin-name">${result.name}</div>
            <div class="result-wear">${result.wearFormatted}</div>
        </div>
    `).join('');
    html += '</div>';
    
    // 3. 显示相似皮肤及其下级皮肤磨损值
    if (similarSkins && similarSkins.length > 0) {
        html += '<div class="result-section-title">🔗 相似皮肤及下级皮肤磨损值</div>';
        
        similarSkins.forEach((skin, index) => {
            // 找到相似皮肤对应的武器箱和皮肤数据
            const targetCase = state.cases.find(c => c.name === skin.crate);
            if (!targetCase) return;
            
            const targetLevel = targetCase.levels.find(l => l.name === state.selectedLevel.name);
            if (!targetLevel) return;
            
            const targetSkin = targetLevel.skins.find(s => s.name === skin.name);
            if (!targetSkin) return;
            
            // 计算该相似皮肤的下级皮肤磨损值
            const currentOrder = levelOrder[state.selectedLevel.name];
            const nextOrder = currentOrder - 1;
            const nextLevel = targetCase.levels.find(l => levelOrder[l.name] === nextOrder);
            
            if (nextLevel) {
                const similarResults = nextLevel.skins.map(lowerSkin => {
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
                
                similarResults.sort((a, b) => a.wear - b.wear);
                
                html += `<div class="similar-skin-section">`;
                html += `<div class="similar-skin-header" onclick="toggleSimilarSkinDetail(${index})">`;
                html += `<span class="similar-skin-toggle-icon" id="toggleIcon${index}">▶</span>`;
                html += `<span class="similar-skin-name">${skin.name}</span>`;
                html += `<span class="similar-skin-crate">${skin.crate}</span>`;
                html += `</div>`;
                html += `<div class="similar-skin-results" id="similarResults${index}" style="display: none;">`;
                similarResults.forEach(result => {
                    html += `<div class="result-card" style="border-left-color: ${result.conditionColor}">`;
                    html += `<div class="result-skin-name">${result.name}</div>`;
                    html += `<div class="result-wear">${result.wearFormatted}</div>`;
                    html += `</div>`;
                });
                html += `</div>`;
                html += `</div>`;
            }
        });
    }
    
    elements.resultsContainer.innerHTML = html;
    
    // 保存相似皮肤数据供点击使用
    state.similarSkins = similarSkins;
    state.currentResults = results;
}

// 切换相似皮肤详情显示
function toggleSimilarSkinDetail(index) {
    const resultsDiv = document.getElementById(`similarResults${index}`);
    const iconSpan = document.getElementById(`toggleIcon${index}`);
    
    if (resultsDiv && iconSpan) {
        if (resultsDiv.style.display === 'none') {
            resultsDiv.style.display = 'block';
            iconSpan.textContent = '▼';
        } else {
            resultsDiv.style.display = 'none';
            iconSpan.textContent = '▶';
        }
    }
}

// 选择相似皮肤
function selectSimilarSkin(index) {
    if (!state.similarSkins || !state.similarSkins[index]) return;
    
    const similarSkin = state.similarSkins[index];
    
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
    
    // 更新当前皮肤信息显示
    const currentSkinInfo = document.querySelector('.current-skin-info');
    if (currentSkinInfo) {
        currentSkinInfo.innerHTML = `
            <span class="current-skin-name">${targetSkin.name}</span>
            <span class="current-skin-wear">${state.wearValue.toFixed(5)}</span>
            <span class="current-skin-crate">${targetCase.name}</span>
        `;
    }
    
    // 更新下级皮肤列表
    const resultList = document.querySelector('.result-list');
    if (resultList) {
        resultList.innerHTML = results.map(result => `
            <div class="result-card" style="border-left-color: ${result.conditionColor}">
                <div class="result-skin-name">${result.name}</div>
                <div class="result-wear">${result.wearFormatted}</div>
            </div>
        `).join('');
    }
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