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
    levelList: document.getElementById('levelList'),
    skinList: document.getElementById('skinList'),
    wearInput: document.getElementById('wearInput'),
    wearRange: document.getElementById('wearRange'),
    calculateBtn: document.getElementById('calculateBtn'),
    resultsContainer: document.getElementById('resultsContainer')
};

// 初始化应用
function init() {
    renderCaseList();
    setupEventListeners();
    
    // 默认选择第一个武器箱
    if (state.cases.length > 0) {
        selectCase(state.cases[0]);
    }
}

// 设置事件监听器
function setupEventListeners() {
    elements.searchInput.addEventListener('input', handleSearch);
    elements.wearInput.addEventListener('input', handleWearInput);
    elements.calculateBtn.addEventListener('click', calculateResults);
    
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

// 渲染皮肤级别列表
function renderLevelList() {
    if (!state.selectedCase) {
        elements.levelList.innerHTML = '<div class="no-data">请先选择武器箱</div>';
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

    elements.levelList.innerHTML = filteredLevels.map(level => `
        <div class="level-item ${state.selectedLevel?.name === level.name ? 'active' : ''}" 
                onclick="selectLevel(${JSON.stringify(level).replace(/"/g, '&quot;')})">
            ${level.name}
        </div>
    `).join('');

    // 默认选择第一个级别
    if (filteredLevels.length > 0 && !state.selectedLevel) {
        selectLevel(filteredLevels[0]);
    }
}

// 渲染皮肤列表
function renderSkinList() {
    if (!state.selectedLevel) {
        elements.skinList.innerHTML = '<div class="no-data">请先选择皮肤级别</div>';
        return;
    }

    elements.skinList.innerHTML = state.selectedLevel.skins.map(skin => `
        <div class="skin-card ${state.selectedSkin?.id === skin.id ? 'active' : ''}" 
                onclick="selectSkin(${JSON.stringify(skin).replace(/"/g, '&quot;')})">
            <div class="skin-image">🔫</div>
            <div class="skin-name">${skin.name}</div>
        </div>
    `).join('');
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
    
    // 自动设置磨损值为中间值
    const midWear = (skin.minWear + skin.maxWear) / 2;
    state.wearValue = midWear;
    elements.wearInput.value = midWear.toFixed(3);
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
            wearFormatted: lowerWear.toFixed(3),
            conditionCode: condition.code,
            conditionText: condition.text,
            conditionColor: condition.color
        };
    });
    
    results.sort((a, b) => a.wear - b.wear);
    displayResults(results);
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
    elements.resultsContainer.innerHTML = results.map(result => `
        <div class="result-card" style="border-left-color: ${result.conditionColor}">
            <div class="result-skin-name">${result.name}</div>
            <div class="result-wear">${result.wearFormatted}</div>
        </div>
    `).join('');
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