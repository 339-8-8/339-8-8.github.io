const UserInventoryEnhanced = {
    // 皮肤级别顺序（从低到高）
    gradeOrder: ['消费级', '工业级', '军规级', '受限级', '保密级', '隐秘级'],
    
    // 存储处理后的数据（全局可访问）
    processedData: null,
    
    // 存储当前最佳汰换结果
    currentTradeupResult: null,
    
    // 存储保存的目标产物记录
    savedTradeupRecords: [],
    
    // 存储选中的武器箱/收藏品
    selectedCrates: {},
    
    // 武器箱/收藏品颜色映射
    crateColors: [
        'crate-color-1', 'crate-color-2', 'crate-color-3', 'crate-color-4',
        'crate-color-5', 'crate-color-6', 'crate-color-7', 'crate-color-8',
        'crate-color-9', 'crate-color-10', 'crate-color-11', 'crate-color-12'
    ],
    
    // 汰换结果颜色映射
    resultCrateColors: [
        'tradeup-result-crate-1', 'tradeup-result-crate-2', 'tradeup-result-crate-3', 
        'tradeup-result-crate-4', 'tradeup-result-crate-5', 'tradeup-result-crate-6',
        'tradeup-result-crate-7', 'tradeup-result-crate-8', 'tradeup-result-crate-9',
        'tradeup-result-crate-10', 'tradeup-result-crate-11', 'tradeup-result-crate-12'
    ],
    
    // 武器箱/收藏品到颜色的映射
    crateColorMap: {},
    
    // 初始化：从localStorage加载保存的记录
    init: function() {
        this.loadSavedRecords();
        
        // 初始化武器箱/收藏品选择功能并渲染列表
        this.initCrateSelection();
        this.renderCrateList();
        
        // 初始化数据备份
        this.backupData = null;
        
        // 初始化快速汰换结果列表
        this.quickTradeupResults = [];
        this.currentResultIndex = 0;
    },
    
    // 备份当前数据状态
    backupCurrentData: function() {
        this.backupData = {
            processedData: this.processedData ? JSON.parse(JSON.stringify(this.processedData)) : null,
            originalSkinsData: window.originalSkinsData ? JSON.parse(JSON.stringify(window.originalSkinsData)) : null,
            selectedCrates: {...this.selectedCrates},
            crateQuantities: {...this.crateQuantities}
        };
        
        // 启用回退按钮
        const rollbackBtn = document.getElementById('tradeupRollbackBtn');
        if (rollbackBtn) {
            rollbackBtn.disabled = false;
        }
    },
    
    // 数据回退
    rollbackData: function() {
        if (!this.backupData) {
            return;
        }
        
        // 恢复数据
        this.processedData = this.backupData.processedData;
        window.originalSkinsData = this.backupData.originalSkinsData;
        this.selectedCrates = {...this.backupData.selectedCrates};
        this.crateQuantities = {...this.backupData.crateQuantities};
        
        // 更新显示
        this.renderCrateList();
        
        // 更新皮肤库存显示
        const importResults = document.getElementById('importResults');
        if (importResults && this.processedData && this.processedData.matched) {
            this.displayResults(this.processedData.matched, importResults, 'matched');
        }
        
        // 清空结果区域
        const resultDiv = document.getElementById('tradeupResult');
        resultDiv.className = 'tradeup-result';
        resultDiv.innerHTML = '';
        
        // 禁用确认和回退按钮
        const confirmBtn = document.getElementById('tradeupConfirmBtn');
        const rollbackBtn = document.getElementById('tradeupRollbackBtn');
        const copyScriptBtn = document.getElementById('tradeupCopyScriptBtn');
        
        if (confirmBtn) confirmBtn.disabled = true;
        if (rollbackBtn) rollbackBtn.disabled = true;
        if (copyScriptBtn) copyScriptBtn.disabled = true;
        
        // 清空当前结果
        this.currentTradeupResult = null;
        
        // 清空快速汰换结果列表
        this.quickTradeupResults = [];
        this.currentResultIndex = 0;
        
        // 清空备份
        this.backupData = null;
    },
    
    // 快速汰换：一次性生成所有结果
    quickTradeup: function() {
        const self = this;
        const resultDiv = document.getElementById('tradeupResult');
        const quickBtn = document.getElementById('tradeupQuickBtn');
        
        // 检查是否已经有汰换结果且未确认/回退
        if ((this.currentTradeupResult || (this.quickTradeupResults && this.quickTradeupResults.length > 0)) && this.backupData) {
            // 已经有汰换结果且未确认/回退，不执行操作
            return;
        }
        
        // 禁用快速汰换按钮，防止重复点击
        if (quickBtn) quickBtn.disabled = true;
        
        // 显示进度条
        resultDiv.className = 'tradeup-result';
        resultDiv.innerHTML = `
            <div class="quick-tradeup-progress">
                <div class="progress-text">正在快速汰换中...</div>
                <div class="progress-bar">
                    <div class="progress-indicator"></div>
                </div>
                <div class="progress-subtext">准备开始计算</div>
            </div>
        `;
        
        // 清空之前的结果
        this.quickTradeupResults = [];
        this.currentResultIndex = 0;
        
        // 延迟执行批量计算，让进度条有显示时间
        setTimeout(function() {
            self.executeQuickTradeupBatch();
        }, 100);
    },
    
    // 批量执行快速汰换
    executeQuickTradeupBatch: function() {
        const self = this;
        const resultDiv = document.getElementById('tradeupResult');
        const quickBtn = document.getElementById('tradeupQuickBtn');
        
        // 在开始计算前备份数据（只有在第一次执行时）
        if (!this.backupData) {
            this.backupCurrentData();
        }
        
        let iterationCount = 0;
        const maxIterations = 100; // 防止无限循环
        
        // 更新进度条显示
        function updateProgress(current, total, status) {
            const progressSubtext = resultDiv.querySelector('.progress-subtext');
            if (progressSubtext) {
                progressSubtext.textContent = `已完成 ${current} 次汰换，${status}`;
            }
        }
        
        function executeNext() {
            if (iterationCount >= maxIterations) {
                // 达到最大迭代次数，停止
                if (self.quickTradeupResults.length > 0) {
                    updateProgress(self.quickTradeupResults.length, maxIterations, '达到最大次数');
                    self.displayQuickTradeupResults();
                } else {
                    resultDiv.className = 'tradeup-result error';
                    resultDiv.innerHTML = '❌ 未找到任何符合条件的组合';
                    // 快速汰换失败，清空备份数据，回退按钮保持禁用
                    self.backupData = null;
                    const rollbackBtn = document.getElementById('tradeupRollbackBtn');
                    if (rollbackBtn) rollbackBtn.disabled = true;
                    if (quickBtn) quickBtn.disabled = false;
                }
                return;
            }
            
            iterationCount++;
            
            // 检查是否有足够皮肤
            const filteredSkins = self.getFilteredSkins();
            if (!filteredSkins || filteredSkins.length < 10) {
                // 皮肤不足，停止快速汰换
                if (self.quickTradeupResults.length > 0) {
                    updateProgress(self.quickTradeupResults.length, maxIterations, '皮肤不足');
                    self.displayQuickTradeupResults();
                } else {
                    resultDiv.className = 'tradeup-result error';
                    resultDiv.innerHTML = '❌ 库存中皮肤数量不足，无法继续快速汰换';
                    // 快速汰换失败，清空备份数据，回退按钮保持禁用
                    self.backupData = null;
                    const rollbackBtn = document.getElementById('tradeupRollbackBtn');
                    if (rollbackBtn) rollbackBtn.disabled = true;
                    if (quickBtn) quickBtn.disabled = false;
                }
                return;
            }
            
            // 更新进度显示
            updateProgress(self.quickTradeupResults.length, maxIterations, '计算中...');
            
            try {
            // 执行计算（不显示结果）
            self.executeTradeupInternalSilent();
            
            // 检查计算结果（立即执行，不延迟）
            const hasResult = self.currentTradeupResult !== null;
            
            if (hasResult) {
                // 保存当前库存数据的快照（用于准确计算原始位置）
                const currentInventorySnapshot = {
                    originalSkinsData: JSON.parse(JSON.stringify(window.originalSkinsData)),
                    processedData: JSON.parse(JSON.stringify(self.processedData))
                };
                
                // 保存当前结果到列表（包含库存快照）
                self.quickTradeupResults.push({
                    skins: self.currentTradeupResult.skins,
                    targetSkin: self.currentTradeupResult.targetSkin,
                    targetWear: self.currentTradeupResult.targetWear,
                    resultingWear: self.currentTradeupResult.resultingWear,
                    inventorySnapshot: currentInventorySnapshot
                });
                
                // 执行确认并清空（不改变按钮状态）
                self.doConfirmAndClear(true);
                
                // 继续下一次
                executeNext();
            } else {
                // 没有结果（报错或无解），停止快速汰换
                if (self.quickTradeupResults.length > 0) {
                    updateProgress(self.quickTradeupResults.length, maxIterations, '计算完成');
                    self.displayQuickTradeupResults();
                } else {
                    resultDiv.className = 'tradeup-result error';
                    resultDiv.innerHTML = '❌ 未找到任何符合条件的组合';
                    // 快速汰换失败，清空备份数据，回退按钮保持禁用
                    self.backupData = null;
                    const rollbackBtn = document.getElementById('tradeupRollbackBtn');
                    if (rollbackBtn) rollbackBtn.disabled = true;
                }
                if (quickBtn) quickBtn.disabled = false;
            }
            } catch (error) {
                console.error('快速汰换计算错误:', error);
                // 发生错误，停止快速汰换
                if (self.quickTradeupResults.length > 0) {
                    updateProgress(self.quickTradeupResults.length, maxIterations, '计算错误');
                    self.displayQuickTradeupResults();
                } else {
                    resultDiv.className = 'tradeup-result error';
                    resultDiv.innerHTML = '❌ 快速汰换过程中发生错误，请检查控制台';
                    // 快速汰换失败，清空备份数据，回退按钮保持禁用
                    self.backupData = null;
                    const rollbackBtn = document.getElementById('tradeupRollbackBtn');
                    if (rollbackBtn) rollbackBtn.disabled = true;
                }
                if (quickBtn) quickBtn.disabled = false;
            }
        }
        
        // 开始执行
        executeNext();
    },
    
    // 执行内部计算（不显示结果，用于快速汰换）
    executeTradeupInternalSilent: function() {
        const targetSkinName = document.getElementById('targetSkinName').value.trim();
        const targetWearValue = parseFloat(document.getElementById('targetWearValue').value.trim());
        const targetMinWearValue = parseFloat(document.getElementById('targetMinWearValue').value.trim());
        
        if (!targetSkinName || isNaN(targetWearValue) || isNaN(targetMinWearValue)) {
            return;
        }
        
        if (targetMinWearValue >= targetWearValue) {
            return;
        }
        
        const filteredSkins = this.getFilteredSkins();
        if (!filteredSkins || filteredSkins.length === 0) {
            return;
        }
        
        const targetSkin = this.findTargetSkin(targetSkinName);
        if (!targetSkin) {
            return;
        }
        
        const lowerGrade = this.getLowerGrade(targetSkin.grade);
        if (!lowerGrade) {
            return;
        }
        
        if (targetWearValue < targetSkin.minWear || targetWearValue > targetSkin.maxWear) {
            return;
        }
        
        const targetConvertedSum = this.calculateConvertedWear(targetWearValue, targetSkin.minWear, targetSkin.maxWear) * 10;
        
        if (!this.selectedCrates[targetSkin.crate]) {
            return;
        }
        
        this.toggleCrateQuantitySection();
        
        const candidateSkins = filteredSkins.filter(skin => {
            return skin.grade === lowerGrade && this.selectedCrates[skin.crate];
        });
        
        if (candidateSkins.length < 10) {
            return;
        }
        
        // 执行计算逻辑（与 executeTradeupInternal 相同，但不显示结果）
        const useQuantityControl = document.getElementById('useQuantityControl');
        const useQuantityControlChecked = useQuantityControl && useQuantityControl.checked;
        
        if (!useQuantityControlChecked) {
            const result = UserInventoryEnhanced.executeTradeupOriginal(candidateSkins, targetConvertedSum);
            if (result && result.group && result.group.length === 10) {
                const resultingWear = this.calculateUpperWear(result.sum, targetSkin.minWear, targetSkin.maxWear);
                
                if (resultingWear <= targetWearValue) {
                    this.currentTradeupResult = {
                        skins: result.group,
                        targetSkin: targetSkin,
                        targetWear: targetWearValue,
                        resultingWear: resultingWear
                    };
                }
            }
        } else {
            const result = UserInventoryEnhanced.executeTradeupWithQuantityControl(candidateSkins, targetConvertedSum);
            if (result && result.group && result.group.length === 10) {
                const resultingWear = this.calculateUpperWear(result.sum, targetSkin.minWear, targetSkin.maxWear);
                
                if (resultingWear <= targetWearValue) {
                    this.currentTradeupResult = {
                        skins: result.group,
                        targetSkin: targetSkin,
                        targetWear: targetWearValue,
                        resultingWear: resultingWear
                    };
                }
            }
        }
    },
    
    // 显示快速汰换结果列表（分页）
    displayQuickTradeupResults: function() {
        const resultDiv = document.getElementById('tradeupResult');
        
        if (this.quickTradeupResults.length === 0) {
            return;
        }
        
        // 显示第一页的结果
        this.displayResultPage(0);
    },
    
    // 显示指定页的结果
    displayResultPage: function(index) {
        const resultDiv = document.getElementById('tradeupResult');
        const result = this.quickTradeupResults[index];
        
        if (!result) return;
        
        const { targetSkin, targetWear, resultingWear, inventorySnapshot } = result;
        
        // 计算每个皮肤的原始位置（使用汰换计算时的库存快照）
        if (result.skins && result.skins.length > 0 && inventorySnapshot) {
            // 为每个皮肤计算原始位置
            result.skins.forEach((skin, idx) => {
                // 使用汰换计算时的库存快照
                const snapshotSkins = inventorySnapshot.originalSkinsData.skins;
                
                // 获取当前皮肤级别的所有皮肤
                const allSkinsInGrade = snapshotSkins.filter(s => 
                    s.grade === skin.grade
                );
                
                // 根据皮肤名称和磨损值精确匹配位置
                let positionInAll = -1;
                for (let i = allSkinsInGrade.length - 1; i >= 0; i--) {
                    if (allSkinsInGrade[i].originalName === skin.originalName && 
                        allSkinsInGrade[i].wear === skin.wear) {
                        positionInAll = i;
                        break;
                    }
                }
                
                // 原始位置是从1开始计数的
                skin.originalPosition = positionInAll !== -1 ? (positionInAll + 1) : 0;
            });
            
            // 按原始位置从大到小排序
            result.skins.sort((a, b) => b.originalPosition - a.originalPosition);
        }
        
        let skinListHtml = '<div class="tradeup-skin-list">';
        result.skins.forEach((skin, index) => {
            const colorClass = this.getCrateColorClass(skin.crate, true);
            skinListHtml += `
                <div class="tradeup-skin-item ${colorClass}">
                    <div class="tradeup-skin-main">
                        <div class="tradeup-skin-name">
                            <span class="tradeup-order">#${index + 1}</span>
                            ${skin.skin}
                        </div>
                        <div class="tradeup-skin-details">
                            <div class="tradeup-skin-info-line">
                                <span class="tradeup-skin-crate">${skin.crate}</span>
                                <span class="tradeup-skin-order-info">原始位置：${skin.originalPosition || ''}</span>
                            </div>
                        </div>
                    </div>
                    <div class="tradeup-skin-wear">${skin.wear}</div>
                </div>
            `;
        });
        skinListHtml += '</div>';
        
        // 保留分页导航，只替换内容部分
        const paginationHtml = `
            <div class="quick-tradeup-pagination">
                <button class="pagination-btn" onclick="UserInventoryEnhanced.prevResultPage()" ${this.currentResultIndex === 0 ? 'disabled' : ''}>◀ 上一页</button>
                <span class="pagination-info">${this.currentResultIndex + 1} / ${this.quickTradeupResults.length}</span>
                <button class="pagination-btn" onclick="UserInventoryEnhanced.nextResultPage()" ${this.currentResultIndex >= this.quickTradeupResults.length - 1 ? 'disabled' : ''}>下一页 ▶</button>
            </div>
            <div class="quick-tradeup-summary">
                共完成 ${this.quickTradeupResults.length} 次汰换
            </div>
        `;
        
        resultDiv.className = 'tradeup-result success';
        resultDiv.innerHTML = `
            <div class="tradeup-summary">
                <div class="tradeup-summary-title">✅ 第 ${index + 1} 次汰换</div>
                <div class="tradeup-summary-details">
                    <div><span class="summary-label">目标产物:</span> <span class="summary-value">${targetSkin.name}</span></div>
                    <div><span class="summary-label">目标磨损:</span> <span class="summary-value">${targetWear.toFixed(6)}</span></div>
                    <div><span class="summary-label">结果磨损:</span> <span class="summary-value highlight">${resultingWear.toFixed(6)}</span></div>
                </div>
            </div>
            ${skinListHtml}
            ${paginationHtml}
        `;
        
        resultDiv.classList.add('show');
        
        // 保存当前查看的结果
        this.currentTradeupResult = result;
        
        // 启用确认和复制按钮
        const confirmBtn = document.getElementById('tradeupConfirmBtn');
        const copyScriptBtn = document.getElementById('tradeupCopyScriptBtn');
        if (confirmBtn) confirmBtn.disabled = false;
        if (copyScriptBtn) copyScriptBtn.disabled = false;
    },
    
    // 上一页
    prevResultPage: function() {
        if (this.currentResultIndex > 0) {
            this.currentResultIndex--;
            this.displayResultPage(this.currentResultIndex);
        }
    },
    
    // 下一页
    nextResultPage: function() {
        if (this.currentResultIndex < this.quickTradeupResults.length - 1) {
            this.currentResultIndex++;
            this.displayResultPage(this.currentResultIndex);
        }
    },
    
    // 执行内部计算（不备份数据）
    executeTradeupInternal: function() {
        const resultDiv = document.getElementById('tradeupResult');
        resultDiv.className = 'tradeup-result';
        resultDiv.innerHTML = '';
        
        const targetSkinName = document.getElementById('targetSkinName').value.trim();
        const targetWearValue = parseFloat(document.getElementById('targetWearValue').value.trim());
        const targetMinWearValue = parseFloat(document.getElementById('targetMinWearValue').value.trim());
        
        if (!targetSkinName || isNaN(targetWearValue) || isNaN(targetMinWearValue)) {
            return;
        }
        
        if (targetMinWearValue >= targetWearValue) {
            return;
        }
        
        const filteredSkins = this.getFilteredSkins();
        if (!filteredSkins || filteredSkins.length === 0) {
            return;
        }
        
        const targetSkin = this.findTargetSkin(targetSkinName);
        if (!targetSkin) {
            return;
        }
        
        const lowerGrade = this.getLowerGrade(targetSkin.grade);
        if (!lowerGrade) {
            return;
        }
        
        if (targetWearValue < targetSkin.minWear || targetWearValue > targetSkin.maxWear) {
            return;
        }
        
        const targetConvertedSum = this.calculateConvertedWear(targetWearValue, targetSkin.minWear, targetSkin.maxWear) * 10;
        
        if (!this.selectedCrates[targetSkin.crate]) {
            return;
        }
        
        this.toggleCrateQuantitySection();
        
        const candidateSkins = filteredSkins.filter(skin => {
            return skin.grade === lowerGrade && this.selectedCrates[skin.crate];
        });
        
        if (candidateSkins.length < 10) {
            return;
        }
        
        candidateSkins.forEach(skin => {
            skin.convertedWear = this.calculateConvertedWear(skin.wear, skin.minWear, skin.maxWear);
            
            if (window.originalSkinsData && window.originalSkinsData.skins) {
                let position = -1;
                for (let i = window.originalSkinsData.skins.length - 1; i >= 0; i--) {
                    if (window.originalSkinsData.skins[i].originalName === skin.originalName && 
                        window.originalSkinsData.skins[i].wear === skin.wear) {
                        position = i;
                        break;
                    }
                }
                skin.originalPosition = position !== -1 ? (position + 1) : 0;
            } else {
                skin.originalPosition = 0;
            }
        });
        
        candidateSkins.sort((a, b) => b.originalPosition - a.originalPosition);
        
        let bestResult = null;
        
        const useQuantityControl = document.getElementById('useQuantityControl');
        const useQuantityControlChecked = useQuantityControl && useQuantityControl.checked;
        
        if (!useQuantityControlChecked) {
            bestResult = this.executeTradeupOriginal(candidateSkins, targetConvertedSum);
        } else {
            const quantityResult = this.executeTradeupWithQuantityControl(candidateSkins, targetConvertedSum);
            
            if (quantityResult && quantityResult.error) {
                resultDiv.className = 'tradeup-result error';
                resultDiv.innerHTML = quantityResult.message;
                return;
            }
            
            bestResult = quantityResult;
        }
        
        if (!bestResult) {
            return;
        }
        
        const resultingWear = this.calculateUpperWear(bestResult.sum, targetSkin.minWear, targetSkin.maxWear);
        
        if (resultingWear > targetWearValue) {
            return;
        }
        
        // 显示成功结果
        
        // 在显示结果前，按照原始位置从大到小排序
        bestResult.group.sort((a, b) => b.originalPosition - a.originalPosition);
        
        // 重新计算所有皮肤的原始位置（基于排序后的顺序）
        if (bestResult.group && bestResult.group.length > 0) {
            bestResult.group.forEach((skin, index) => {
                // 获取当前皮肤级别的所有皮肤
                const allSkinsInGrade = window.originalSkinsData.skins.filter(s => 
                    s.grade === skin.grade
                );
                
                // 根据皮肤名称和磨损值精确匹配位置
                let positionInAll = -1;
                for (let i = allSkinsInGrade.length - 1; i >= 0; i--) {
                    if (allSkinsInGrade[i].originalName === skin.originalName && 
                        allSkinsInGrade[i].wear === skin.wear) {
                        positionInAll = i;
                        break;
                    }
                }
                
                // 原始位置是从1开始计数的
                skin.originalPosition = positionInAll !== -1 ? (positionInAll + 1) : 0;
            });
        }
        
        let skinListHtml = '<div class="tradeup-skin-list">';
        bestResult.group.forEach((skin, index) => {
            const colorClass = this.getCrateColorClass(skin.crate, true);
            skinListHtml += `
                <div class="tradeup-skin-item ${colorClass}">
                    <div class="tradeup-skin-main">
                        <div class="tradeup-skin-name">
                            <span class="tradeup-order">#${index + 1}</span>
                            ${skin.skin}
                        </div>
                        <div class="tradeup-skin-details">
                            <div class="tradeup-skin-info-line">
                                <span class="tradeup-skin-crate">${skin.crate}</span>
                                <span class="tradeup-skin-order-info">原始位置：${skin.originalPosition}</span>
                            </div>
                        </div>
                    </div>
                    <div class="tradeup-skin-wear">${skin.wear}</div>
                </div>
            `;
        });
        skinListHtml += '</div>';
        
        resultDiv.className = 'tradeup-result success';
        resultDiv.innerHTML = `
            <div class="tradeup-summary">
                <div class="tradeup-summary-title">✅ 找到最佳组合！</div>
                <div class="tradeup-summary-details">
                    <div><span class="summary-label">目标产物:</span> <span class="summary-value">${targetSkin.name}</span></div>
                    <div><span class="summary-label">目标磨损:</span> <span class="summary-value">${targetWearValue.toFixed(6)}</span></div>
                    <div><span class="summary-label">结果磨损:</span> <span class="summary-value highlight">${resultingWear.toFixed(6)}</span></div>
                </div>
            </div>
            ${skinListHtml}
        `;
        
        resultDiv.classList.add('show');
        
        // 保存当前结果并启用确认和复制按钮
        this.currentTradeupResult = {
            skins: bestResult.group,
            targetSkin: targetSkin,
            targetWear: targetWearValue,
            resultingWear: resultingWear
        };
        
        const confirmBtn = document.getElementById('tradeupConfirmBtn');
        const copyScriptBtn = document.getElementById('tradeupCopyScriptBtn');
        if (confirmBtn && copyScriptBtn) {
            confirmBtn.disabled = false;
            copyScriptBtn.disabled = false;
        }
    },
    
    // 执行确认并清空（内部方法，不备份数据）
    doConfirmAndClear: function(skipButtonState = false) {
        if (!this.currentTradeupResult) {
            return;
        }
        
        const skinsToRemove = this.currentTradeupResult.skins;
        const targetSkin = this.currentTradeupResult.targetSkin;
        
        if (this.processedData && this.processedData.matched) {
            const skinsToRemoveSet = new Set(skinsToRemove.map(s => `${s.skin}-${s.wear}`));
            
            this.processedData.matched = this.processedData.matched.filter(skin => {
                return !skinsToRemoveSet.has(`${skin.skin}-${skin.wear}`);
            });
            
            this.processedData.summary.totalMatched = this.processedData.matched.length;
            this.processedData.summary.totalUnmatched = this.processedData.unmatched.length;
            this.processedData.summary.matchRate = this.processedData.summary.totalProcessed > 0 ? 
                (this.processedData.summary.totalMatched / this.processedData.summary.totalProcessed * 100).toFixed(2) : 0;
            
            window.userProcessedData = this.processedData;
        }
        
        if (window.originalSkinsData && window.originalSkinsData.skins) {
            const skinsToRemoveSet = new Set(skinsToRemove.map(s => `${s.originalName}-${s.wear}`));
            
            window.originalSkinsData.skins = window.originalSkinsData.skins.filter(skin => {
                return !skinsToRemoveSet.has(`${skin.originalName}-${skin.wear}`);
            });
            
            if (targetSkin) {
                const upperGradeSkin = {
                    originalName: '合成产物',
                    processedName: '合成产物',
                    wear: 0.111111111,
                    grade: targetSkin.grade
                };
                window.originalSkinsData.skins.unshift(upperGradeSkin);
            }
        }
        
        const resultDiv = document.getElementById('tradeupResult');
        resultDiv.className = 'tradeup-result';
        resultDiv.innerHTML = '';
        
        if (!skipButtonState) {
            const confirmBtn = document.getElementById('tradeupConfirmBtn');
            const copyScriptBtn = document.getElementById('tradeupCopyScriptBtn');
            if (confirmBtn) confirmBtn.disabled = true;
            if (copyScriptBtn) copyScriptBtn.disabled = true;
        }
        
        this.currentTradeupResult = null;
    },

    // 从localStorage加载保存的记录
    loadSavedRecords: function() {
        try {
            const savedRecords = localStorage.getItem('tradeupSavedRecords');
            if (savedRecords) {
                this.savedTradeupRecords = JSON.parse(savedRecords);
                this.renderSavedRecords();
                
                // 如果有记录，显示保存记录区域
                if (this.savedTradeupRecords.length > 0) {
                    const savedRecords = document.getElementById('tradeupSavedRecords');
                    if (savedRecords) {
                        savedRecords.style.display = 'block';
                    }
                }
            }
        } catch (error) {
            console.error('加载保存的记录时出错:', error);
            this.savedTradeupRecords = [];
        }
    },
    
    // 保存记录到localStorage
    saveToLocalStorage: function() {
        try {
            localStorage.setItem('tradeupSavedRecords', JSON.stringify(this.savedTradeupRecords));
        } catch (error) {
            console.error('保存记录到localStorage时出错:', error);
        }
    },
    
    // 获取处理后的数据（供外部调用）
    getProcessedData: function() {
        return this.processedData;
    },
    
    // 获取匹配的皮肤数据
    getMatchedSkins: function() {
        return this.processedData ? this.processedData.matched : [];
    },
    
    // 获取未匹配的皮肤数据
    getUnmatchedSkins: function() {
        return this.processedData ? this.processedData.unmatched : [];
    },
    
    // 获取汇总信息
    getSummary: function() {
        return this.processedData ? this.processedData.summary : null;
    },
    
    // 按武器箱和级别组织的数据
    getOrganizedData: function() {
        if (!this.processedData) return null;
        return this.organizeByCrateAndGrade(this.processedData);
    },
    
    // 处理粘贴的皮肤数据（优化版）
    processPastedData: function(text) {
        const lines = text.split('\n');
        const skinData = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 匹配磨损行
            if (line.startsWith('磨损:')) {
                const wearMatch = line.match(/磨损:\s*([\d.]+)/);
                if (wearMatch && i + 1 < lines.length) {
                    const wearValue = parseFloat(wearMatch[1]);
                    const skinNameLine = lines[i + 1].trim();
                    
                    // 提取皮肤名称（移除价格和磨损等级）
                    const skinNameMatch = skinNameLine.match(/^([^¥]+)/);
                    if (skinNameMatch) {
                        let skinName = skinNameMatch[1].trim();
                        
                        // 移除磨损等级和多余空格
                        skinName = skinName.replace(/\s*\([^)]+\)$/, '').trim();
                        
                        skinData.push({
                            originalName: skinNameLine,
                            processedName: skinName,
                            wear: wearValue
                        });
                    }
                }
            }
        }
        
        return skinData;
    },

    // 增强的名称标准化函数
    normalizeSkinName: function(name) {
        return name
            .replace(/\s+/g, '') // 移除所有空格
            .toLowerCase() // 转为小写
            .replace(/x27/g, 'x27') // 统一X27格式
            .replace(/ar/g, 'ar') // 统一AR格式
            .replace(/cz75自动型/g, 'cz75') // 处理CZ75自动型变体
            .replace(/cz75/g, 'cz75') // 统一CZ75格式
            .replace(/mp5-sd/g, 'mp5sd') // 统一MP5-SD格式
            .replace(/p2000/g, 'p2000') // 统一P2000格式
            .replace(/m4a4/g, 'm4a4') // 统一M4A4格式
            .replace(/scar-20/g, 'scar20') // 统一SCAR-20格式
            .replace(/双持贝瑞塔/g, '双持贝瑞塔') // 统一双持贝瑞塔格式
            .replace(/沙漠之鹰/g, '沙漠之鹰'); // 统一沙漠之鹰格式
    },

    // 在data.js中查找匹配的皮肤（增强版）
    findMatchingSkin: function(skinName, casesData) {
        const normalizedInput = this.normalizeSkinName(skinName);
        
        // 首先尝试精确匹配
        for (const crate of casesData) {
            for (const level of crate.levels) {
                for (const skin of level.skins) {
                    const normalizedSkin = this.normalizeSkinName(skin.name);
                    if (normalizedInput === normalizedSkin) {
                        return {
                            crate: crate.name,
                            grade: level.name,
                            skin: skin.name,
                            minWear: skin.minWear,
                            maxWear: skin.maxWear,
                            matched: true,
                            matchType: 'exact'
                        };
                    }
                }
            }
        }
        
        // 然后尝试包含匹配
        for (const crate of casesData) {
            for (const level of crate.levels) {
                for (const skin of level.skins) {
                    const normalizedSkin = this.normalizeSkinName(skin.name);
                    if (normalizedInput.includes(normalizedSkin) || normalizedSkin.includes(normalizedInput)) {
                        return {
                            crate: crate.name,
                            grade: level.name,
                            skin: skin.name,
                            minWear: skin.minWear,
                            maxWear: skin.maxWear,
                            matched: true,
                            matchType: 'contains'
                        };
                    }
                }
            }
        }
        
        // 最后尝试部分匹配
        for (const crate of casesData) {
            for (const level of crate.levels) {
                for (const skin of level.skins) {
                    const normalizedSkin = this.normalizeSkinName(skin.name);
                    if (normalizedInput.indexOf(normalizedSkin) !== -1 || normalizedSkin.indexOf(normalizedInput) !== -1) {
                        return {
                            crate: crate.name,
                            grade: level.name,
                            skin: skin.name,
                            minWear: skin.minWear,
                            maxWear: skin.maxWear,
                            matched: true,
                            matchType: 'partial'
                        };
                    }
                }
            }
        }
        
        return {
            matched: false,
            originalName: skinName,
            matchType: 'none'
        };
    },

    // 处理所有皮肤数据
    processAllSkins: function(pastedText, casesData) {
        const processedSkins = this.processPastedData(pastedText);
        const results = {
            matched: [],
            unmatched: [],
            summary: {
                totalProcessed: processedSkins.length,
                totalMatched: 0,
                totalUnmatched: 0,
                matchRate: 0
            }
        };
        
        // 清空并重新初始化原始数据存储
        window.originalSkinsData = {
            processedAt: new Date().toISOString(),
            skins: [],
            summary: {
                totalProcessed: processedSkins.length
            }
        };
        
        // 清空并重新初始化数据存储
        window.processedSkinsData = {
            processedAt: new Date().toISOString(),
            skins: [],
            summary: {
                totalProcessed: processedSkins.length,
                totalMatched: 0,
                totalUnmatched: 0,
                matchRate: 0
            }
        };
        
        // 先匹配所有皮肤并收集信息
        const skinMatchResults = [];
        for (const skin of processedSkins) {
            const matchResult = this.findMatchingSkin(skin.processedName, casesData);
            skinMatchResults.push({
                skin: skin,
                matchResult: matchResult
            });
        }
        
        // 存储原始皮肤数据（包含皮肤级别）
        for (let i = 0; i < processedSkins.length; i++) {
            const skin = processedSkins[i];
            const matchResult = skinMatchResults[i].matchResult;
            const grade = matchResult.matched ? matchResult.grade : '未知';
            window.originalSkinsData.skins.push({
                originalName: skin.originalName,
                processedName: skin.processedName,
                wear: skin.wear,
                grade: grade
            });
        }
        
        // 处理皮肤数据
        for (let i = 0; i < processedSkins.length; i++) {
            const skin = processedSkins[i];
            const matchResult = skinMatchResults[i].matchResult;
            
            if (matchResult.matched) {
                // 计算转换磨损值
                let convertedWear = 0;
                const wearRange = matchResult.maxWear - matchResult.minWear;
                if (wearRange > 0) {
                    convertedWear = (skin.wear - matchResult.minWear) / wearRange;
                    // 确保在 0-1 范围内
                    convertedWear = Math.max(0, Math.min(1, convertedWear));
                }
                
                const matchedSkin = {
                    originalName: skin.originalName,
                    processedName: skin.processedName,
                    wear: skin.wear,
                    minWear: matchResult.minWear,
                    maxWear: matchResult.maxWear,
                    convertedWear: convertedWear.toFixed(6),
                    crate: matchResult.crate,
                    grade: matchResult.grade,
                    skin: matchResult.skin,
                    matchType: matchResult.matchType
                };
                
                results.matched.push(matchedSkin);
                window.processedSkinsData.skins.push(matchedSkin);
            } else {
                const unmatchedSkin = {
                    originalName: skin.originalName,
                    processedName: skin.processedName,
                    wear: skin.wear,
                    matchType: matchResult.matchType
                };
                
                results.unmatched.push(unmatchedSkin);
                window.processedSkinsData.skins.push(unmatchedSkin);
            }
        }
        
        // 更新汇总信息
        results.summary.totalMatched = results.matched.length;
        results.summary.totalUnmatched = results.unmatched.length;
        results.summary.matchRate = results.summary.totalProcessed > 0 ? 
            (results.summary.totalMatched / results.summary.totalProcessed * 100).toFixed(2) : 0;
        
        window.processedSkinsData.summary = {...results.summary};
        
        // 按磨损值从低到高排序
        results.matched.sort((a, b) => a.wear - b.wear);
        results.unmatched.sort((a, b) => a.wear - b.wear);
        
        return results;
    },

    // 按照武器箱/皮肤级别/单个皮肤数据格式汇总
    organizeByCrateAndGrade: function(results) {
        const organizedData = {};
        
        // 处理匹配的皮肤
        results.matched.forEach(skin => {
            if (!organizedData[skin.crate]) {
                organizedData[skin.crate] = {};
            }
            
            if (!organizedData[skin.crate][skin.grade]) {
                organizedData[skin.crate][skin.grade] = [];
            }
            
            organizedData[skin.crate][skin.grade].push({
                name: skin.skin,
                wear: skin.wear,
                minWear: skin.minWear,
                maxWear: skin.maxWear,
                convertedWear: skin.convertedWear,
                originalName: skin.originalName,
                matchType: skin.matchType
            });
        });
        
        return organizedData;
    },

    // 生成用户临时仓库文件（JSON格式）
    generateUserInventoryFile: function(results) {
        const organizedData = this.organizeByCrateAndGrade(results);
        
        const inventoryData = {
            processedAt: new Date().toISOString(),
            summary: results.summary,
            organizedByCrate: organizedData,
            matchedSkins: results.matched,
            unmatchedSkins: results.unmatched
        };
        
        return `const userTemporaryInventory = ${JSON.stringify(inventoryData, null, 2)};`;
    },

    // 保存到user_temporary_inventory.js文件（不下载到本地）
    saveToFile: function(content) {
        // 创建Blob对象
        const blob = new Blob([content], { type: 'application/javascript' });
        
        // 创建文件读取器
        const reader = new FileReader();
        reader.onload = function(e) {
            // 将内容写入user_temporary_inventory.js
            const scriptContent = e.target.result;
            
            // 创建script标签并执行
            const script = document.createElement('script');
            script.textContent = scriptContent;
            document.head.appendChild(script);
            
        };
        reader.readAsText(blob);
    },

    // 主处理函数
    handlePasteAndProcess: function() {
        const pasteTextarea = document.getElementById('pasteTextarea');
        const statusText = document.getElementById('statusText');
        const statusCount = document.getElementById('statusCount');
        const progressFill = document.getElementById('progressFill');
        const processBtn = document.getElementById('processBtn');
        const processStatus = document.getElementById('processStatus');
        
        const pastedText = pasteTextarea.value.trim();
        
        if (!pastedText) {
            alert('请先粘贴皮肤数据');
            return;
        }
        
        // 隐藏按钮，显示进度条
        processBtn.style.display = 'none';
        processStatus.style.display = 'block';
        
        // 更新状态
        statusText.textContent = '正在处理皮肤数据...';
        statusCount.textContent = '0%';
        progressFill.style.width = '0%';
        
        setTimeout(() => {
            try {
                // 处理数据
                const results = this.processAllSkins(pastedText, window.casesData);
                
                // 保存处理后的数据到全局变量
                this.processedData = results;
                
                // 同时保存到window对象，方便外部调用
                window.userProcessedData = results;
                
                // 更新进度
                statusText.textContent = '处理完成';
                statusCount.textContent = '100%';
                progressFill.style.width = '100%';
                
                // 隐藏进度条，显示按钮
                setTimeout(() => {
                    processStatus.style.display = 'none';
                    processBtn.style.display = 'block';
                }, 500);
                
                // 生成并保存文件
                const fileContent = this.generateUserInventoryFile(results);
                this.saveToFile(fileContent);
                
                // 显示皮肤库存（完整版）
                const importResults = document.getElementById('importResults');
                this.displayResults(results.matched, importResults, 'matched');
                
                // 初始化武器箱/收藏品选择功能并渲染列表
                this.initCrateSelection();
                this.renderCrateList();
                
                // 显示一键汰换区域
                const tradeupSection = document.getElementById('tradeupSection');
                if (tradeupSection) {
                    tradeupSection.style.display = 'block';
                }
                
                // 显示确认和复制按钮（禁用状态）
                const confirmBtn = document.getElementById('tradeupConfirmBtn');
                const copyScriptBtn = document.getElementById('tradeupCopyScriptBtn');
                if (confirmBtn && copyScriptBtn) {
                    confirmBtn.style.display = 'block';
                    copyScriptBtn.style.display = 'block';
                    confirmBtn.disabled = true;
                    copyScriptBtn.disabled = true;
                }
                
                // 数据处理后，收起皮肤库存版块
                const inventoryContent = document.getElementById('inventoryContent');
                const inventoryToggle = document.getElementById('inventoryToggle');
                if (inventoryContent && inventoryToggle) {
                    inventoryContent.classList.add('collapsed');
                    inventoryToggle.textContent = '▶';
                    inventoryToggle.classList.add('collapsed');
                }
                
                // 弹出提示框显示处理结果
                this.showProcessResultPopup(results);
                
            } catch (error) {
                console.error('处理皮肤数据时出错:', error);
                statusText.textContent = '处理失败';
                statusCount.textContent = '错误';
                
                // 隐藏进度条，显示按钮
                processStatus.style.display = 'none';
                processBtn.style.display = 'block';
                
                alert('处理皮肤数据时出错：' + error.message);
            }
        }, 100);
    },

    // 显示结果
    displayResults: function(results, container, type) {
        if (type === 'unmatched') {
            return;
        }
        
        // 匹配结果：显示筛选区域和紧凑列表
        if (!results.length) {
            container.innerHTML = '<div class="no-data">没有匹配的皮肤数据</div>';
            return;
        }
        
        // 填充筛选选项
        this.populateFilterOptions(results);
        
        // 直接显示所有结果，不经过筛选
        this.filterAndDisplayCompact(results);
    },
    
    // 显示未匹配皮肤（紧凑版）
    displayUnmatchedCompact: function(results) {
        // 未使用此函数了
    },
    
    // 显示匹配皮肤（紧凑版）
    displayMatchedCompact: function(results) {
        // 未使用此函数了
    },
    
    // 显示汇总信息（紧凑版）
    displaySummaryCompact: function(results) {
        const summaryContent = document.getElementById('summaryContentCompact');
        summaryContent.innerHTML = `
            共处理 ${results.summary.totalProcessed} 个皮肤<br>
            匹配成功: ${results.summary.totalMatched} 个 (${results.summary.matchRate}%)<br>
            未匹配: ${results.summary.totalUnmatched} 个<br>
        `;
        
        // 显示未匹配皮肤
        const unmatchedSection = document.getElementById('unmatchedSection');
        const unmatchedList = document.getElementById('unmatchedList');
        
        if (results.summary.totalUnmatched > 0 && results.unmatched && results.unmatched.length > 0) {
            unmatchedSection.style.display = 'block';
            
            let html = '';
            results.unmatched.forEach(skin => {
                html += `<div class="unmatched-item">• ${skin.originalName || skin.processedName}</div>`;
            });
            unmatchedList.innerHTML = html;
        } else {
            unmatchedSection.style.display = 'none';
        }
    },
    
    // 填充筛选选项
    populateFilterOptions: function(matchedSkins) {
        const crateSelect = document.getElementById('crateSelect');
        const gradeSelect = document.getElementById('gradeSelect');
        const skinSelect = document.getElementById('skinSelect');
        const filterSection = document.getElementById('filterSection');
        
        // 获取所有唯一的武器箱
        const crates = [...new Set(matchedSkins.map(s => s.crate))];
        
        // 填充武器箱选项
        crateSelect.innerHTML = '<option value="">全部武器箱</option>';
        crates.forEach(crate => {
            crateSelect.innerHTML += `<option value="${crate}">${crate}</option>`;
        });
        
        // 初始填充所有级别
        this.updateGradeOptions(matchedSkins);
        
        // 初始填充所有皮肤
        this.updateSkinOptions(matchedSkins);
        
        // 显示筛选区域
        filterSection.style.display = 'block';
        
        // 绑定筛选事件
        const self = this;
        crateSelect.onchange = function() {
            self.updateGradeOptionsBasedOnCrate();
            self.updateSkinOptionsBasedOnFilters();
            self.applyFilters();
        };
        gradeSelect.onchange = function() {
            self.updateSkinOptionsBasedOnFilters();
            self.applyFilters();
        };
        skinSelect.onchange = function() {
            self.applyFilters();
        };
    },
    
    // 根据选择的武器箱更新皮肤级别选项
    updateGradeOptionsBasedOnCrate: function() {
        const crateSelect = document.getElementById('crateSelect');
        const allMatched = this.getMatchedSkins();
        
        let filteredSkins = allMatched;
        if (crateSelect.value) {
            filteredSkins = allMatched.filter(s => s.crate === crateSelect.value);
        }
        
        this.updateGradeOptions(filteredSkins);
    },
    
    // 根据筛选条件更新皮肤选项
    updateSkinOptionsBasedOnFilters: function() {
        const crateSelect = document.getElementById('crateSelect');
        const gradeSelect = document.getElementById('gradeSelect');
        const allMatched = this.getMatchedSkins();
        
        let filteredSkins = allMatched;
        if (crateSelect.value) {
            filteredSkins = filteredSkins.filter(s => s.crate === crateSelect.value);
        }
        if (gradeSelect.value) {
            filteredSkins = filteredSkins.filter(s => s.grade === gradeSelect.value);
        }
        
        this.updateSkinOptions(filteredSkins);
    },
    
    // 更新皮肤级别选项
    updateGradeOptions: function(skins) {
        const gradeSelect = document.getElementById('gradeSelect');
        const grades = [...new Set(skins.map(s => s.grade))];
        
        gradeSelect.innerHTML = '<option value="">全部级别</option>';
        grades.forEach(grade => {
            gradeSelect.innerHTML += `<option value="${grade}">${grade}</option>`;
        });
    },
    
    // 更新皮肤选项
    updateSkinOptions: function(skins) {
        const skinSelect = document.getElementById('skinSelect');
        const skinNames = [...new Set(skins.map(s => s.skin))];
        
        skinSelect.innerHTML = '<option value="">全部皮肤</option>';
        skinNames.forEach(skinName => {
            skinSelect.innerHTML += `<option value="${skinName}">${skinName}</option>`;
        });
    },
    
    // 应用筛选
    applyFilters: function() {
        const crateSelect = document.getElementById('crateSelect');
        const gradeSelect = document.getElementById('gradeSelect');
        const skinSelect = document.getElementById('skinSelect');
        const allMatched = this.getMatchedSkins();
        
        const filtered = allMatched.filter(skin => {
            const crateMatch = !crateSelect.value || skin.crate === crateSelect.value;
            const gradeMatch = !gradeSelect.value || skin.grade === gradeSelect.value;
            const skinMatch = !skinSelect.value || skin.skin === skinSelect.value;
            return crateMatch && gradeMatch && skinMatch;
        });
        
        this.filterAndDisplayCompact(filtered);
    },
    
    // 紧凑显示皮肤列表
    filterAndDisplayCompact: function(skins) {
        const container = document.getElementById('importResults');
        const inventoryCount = document.getElementById('inventoryCount');
        
        // 更新库存数量
        if (inventoryCount) {
            inventoryCount.textContent = skins.length;
        }
        
        if (!skins.length) {
            container.innerHTML = '<div class="no-data">没有符合条件的皮肤</div>';
            return;
        }
        
        let html = '<div class="compact-skin-list">';
        skins.forEach(skin => {
            const colorClass = this.getCrateColorClass(skin.crate, true);
            html += `
                <div class="compact-skin-item ${colorClass}">
                    <div class="compact-skin-info">
                        <div class="compact-skin-name">${skin.skin}</div>
                        <div class="compact-skin-details">${skin.crate} · ${skin.grade}</div>
                    </div>
                    <div class="compact-skin-wear">${skin.wear}</div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    },

    // 导出处理后的数据为JSON文件
    exportData: function() {
        const data = this.getProcessedData();
        if (!data) {
            alert('没有可导出的数据，请先处理皮肤数据');
            return;
        }
        
        const jsonContent = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = '皮肤数据_' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('✅ 数据已导出！');
    },

    // 在casesData中查找目标皮肤
    findTargetSkin: function(skinName) {
        const normalizedName = this.normalizeSkinName(skinName);
        for (const crate of casesData) {
            for (const level of crate.levels) {
                for (const skin of level.skins) {
                    const normalizedSkin = this.normalizeSkinName(skin.name);
                    if (normalizedName === normalizedSkin) {
                        return {
                            name: skin.name,
                            grade: level.name,
                            minWear: skin.minWear,
                            maxWear: skin.maxWear,
                            crate: crate.name
                        };
                    }
                }
            }
        }
        return null;
    },

    // 获取下一级皮肤级别
    getLowerGrade: function(grade) {
        const index = this.gradeOrder.indexOf(grade);
        if (index <= 0) return null;
        return this.gradeOrder[index - 1];
    },

    // 计算转换磨损值
    calculateConvertedWear: function(wear, minWear, maxWear) {
        const range = maxWear - minWear;
        if (range <= 0) return 0;
        let converted = (wear - minWear) / range;
        return Math.max(0, Math.min(1, converted));
    },

    // 计算上级皮肤磨损值
    calculateUpperWear: function(convertedSum, upperMinWear, upperMaxWear) {
        const avgConverted = convertedSum / 10;
        return avgConverted * (upperMaxWear - upperMinWear) + upperMinWear;
    },

    // 贪心优化：尝试替换皮肤使总和最大且不超过目标
    greedyOptimize: function(initialGroup, allSkins, targetConvertedSum) {
        let bestGroup = [...initialGroup];
        let bestSum = initialGroup.reduce((sum, s) => sum + parseFloat(s.convertedWear), 0);
        
        const availableSkins = allSkins.filter(s => !initialGroup.includes(s));
        
        let improved = true;
        let iterations = 0;
        const maxIterations = 100;
        
        while (improved && iterations < maxIterations) {
            improved = false;
            iterations++;
            
            for (let i = 0; i < bestGroup.length; i++) {
                for (const replacementSkin of availableSkins) {
                    if (bestGroup.includes(replacementSkin)) continue;
                    
                    const testGroup = [...bestGroup];
                    testGroup[i] = replacementSkin;
                    const testSum = testGroup.reduce((sum, s) => sum + parseFloat(s.convertedWear), 0);
                    
                    if (testSum <= targetConvertedSum && testSum > bestSum) {
                        bestGroup = testGroup;
                        bestSum = testSum;
                        improved = true;
                    }
                }
            }
        }
        
        return { group: bestGroup, sum: bestSum };
    },

    // 执行一键汰换
    executeTradeup: function() {
        const resultDiv = document.getElementById('tradeupResult');
        
        // 检查是否已经有汰换结果且未确认/回退
        if ((this.currentTradeupResult || (this.quickTradeupResults && this.quickTradeupResults.length > 0)) && this.backupData) {
            // 已经有汰换结果且未确认/回退，不执行操作
            return;
        }
        
        resultDiv.className = 'tradeup-result';
        resultDiv.innerHTML = '';
        
        const targetSkinName = document.getElementById('targetSkinName').value.trim();
        const targetWearValue = parseFloat(document.getElementById('targetWearValue').value.trim());
        const targetMinWearValue = parseFloat(document.getElementById('targetMinWearValue').value.trim());
        
        if (!targetSkinName) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 请输入目标产物名字';
            return;
        }
        
        if (isNaN(targetWearValue)) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 请输入有效的目标产物磨损值';
            return;
        }
        
        if (isNaN(targetMinWearValue)) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 请输入有效的目标产物最低磨损值';
            return;
        }
        
        if (targetMinWearValue >= targetWearValue) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 目标产物最低磨损值必须小于目标产物磨损值';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        const filteredSkins = this.getFilteredSkins();
        if (!filteredSkins || filteredSkins.length === 0) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 没有符合条件的皮肤数据，请先处理皮肤数据或选择武器箱/收藏品';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        const targetSkin = this.findTargetSkin(targetSkinName);
        if (!targetSkin) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 未找到目标产物: ' + targetSkinName;
            return;
        }
        
        const lowerGrade = this.getLowerGrade(targetSkin.grade);
        if (!lowerGrade) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 该目标产物没有下级皮肤';
            return;
        }
        
        if (targetWearValue < targetSkin.minWear || targetWearValue > targetSkin.maxWear) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = `❌ 目标产物磨损值超出范围 (${targetSkin.minWear} - ${targetSkin.maxWear})`;
            return;
        }
        
        const targetConvertedSum = this.calculateConvertedWear(targetWearValue, targetSkin.minWear, targetSkin.maxWear) * 10;
        
        // 检查目标产物武器箱是否被选中
        if (!this.selectedCrates[targetSkin.crate]) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = `❌ 目标产物"${targetSkinName}"的武器箱"${targetSkin.crate}"未被选中，请先选中该武器箱`;
            return;
        }
        
        // 显示/隐藏武器箱数量设置区域
        this.toggleCrateQuantitySection();
        
        const candidateSkins = filteredSkins.filter(skin => {
            return skin.grade === lowerGrade && this.selectedCrates[skin.crate];
        });
        
        if (candidateSkins.length < 10) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = `❌ 库存中下级皮肤数量不足 (需要10个, 当前${candidateSkins.length}个)`;
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        candidateSkins.forEach(skin => {
            skin.convertedWear = this.calculateConvertedWear(skin.wear, skin.minWear, skin.maxWear);
            
            // 计算皮肤在原始数据中的位置顺序
            if (window.originalSkinsData && window.originalSkinsData.skins) {
                let position = -1;
                
                // 直接在原始数据（筛选前）中从后往前找
                for (let i = window.originalSkinsData.skins.length - 1; i >= 0; i--) {
                    if (window.originalSkinsData.skins[i].originalName === skin.originalName && 
                        window.originalSkinsData.skins[i].wear === skin.wear) {
                        position = i;
                        break;
                    }
                }
                
                // 位置就是在原始数组中的索引+1
                skin.originalPosition = position !== -1 ? (position + 1) : 0;
            } else {
                skin.originalPosition = 0;
            }
        });
        
        // 按照原始数据位置顺序排序（位置越大，序号越小）
        candidateSkins.sort((a, b) => b.originalPosition - a.originalPosition);
        
        let bestResult = null;
        
        // 在执行计算前备份数据（只在第一次执行时备份）
        this.backupCurrentData();
        
        // 在执行汰换计算前保存用户设置的皮肤数量
        const originalCrateQuantities = {...this.crateQuantities};
        
        // 根据开关状态调用不同的汰换算法
        const useQuantityControl = document.getElementById('useQuantityControl');
        const useQuantityControlChecked = useQuantityControl && useQuantityControl.checked;
        
        if (!useQuantityControlChecked) {
            // 开关关闭，使用第一套算法（原始算法）
            bestResult = this.executeTradeupOriginal(candidateSkins, targetConvertedSum);
        } else {
            // 开关开启，使用第二套算法（带数量控制）
            const quantityResult = this.executeTradeupWithQuantityControl(candidateSkins, targetConvertedSum);
            
            // 处理算法返回的错误信息
            if (quantityResult && quantityResult.error) {
                resultDiv.className = 'tradeup-result error';
                resultDiv.innerHTML = quantityResult.message;
                return;
            }
            
            bestResult = quantityResult;
        }
        
        // 汰换计算完成后，恢复用户设置的皮肤数量
        this.crateQuantities = {...originalCrateQuantities};
        this.updateCrateQuantityUI();
        
        if (!bestResult) {
            resultDiv.className = 'tradeup-result error';
            
            // 提供更详细的错误信息
            const selectedCrates = uniqueCrates.filter(crate => this.selectedCrates[crate]);
            const crateCount = selectedCrates.length;
            
            let errorMessage = '❌ 无法找到符合条件的皮肤组合<br>';
            errorMessage += `选中的武器箱数量: ${crateCount}<br>`;
            
            if (crateCount === 1) {
                errorMessage += '使用原始算法计算，可能库存中下级皮肤磨损值过高';
            } else {
                errorMessage += '使用数量控制算法计算，可能原因：<br>';
                errorMessage += '• 各武器箱可用皮肤数量不足<br>';
                errorMessage += '• 皮肤组合无法达到目标磨损值要求';
            }
            
            resultDiv.innerHTML = errorMessage;
            return;
        }
        
        const resultingWear = this.calculateUpperWear(bestResult.sum, targetSkin.minWear, targetSkin.maxWear);
        
        if (resultingWear > targetWearValue) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = `❌ 汰换结果超出目标磨损值 (目标: ${targetWearValue.toFixed(6)}, 结果: ${resultingWear.toFixed(6)})`;
            return;
        }
        
        if (resultingWear < targetMinWearValue) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = `❌ 汰换结果低于目标产物最低磨损值 (最低: ${targetMinWearValue.toFixed(6)}, 结果: ${resultingWear.toFixed(6)})`;
            return;
        }
        
        // 在显示结果前，按照原始位置从大到小排序
        bestResult.group.sort((a, b) => b.originalPosition - a.originalPosition);
        
        // 重新计算所有皮肤的原始位置（基于排序后的顺序）
        if (window.originalSkinsData && window.originalSkinsData.skins) {
            bestResult.group.forEach((skin, index) => {
                // 获取当前皮肤级别的所有皮肤
                const allSkinsInGrade = window.originalSkinsData.skins.filter(s => 
                    s.grade === skin.grade
                );
                
                // 根据皮肤名称和磨损值精确匹配位置
                let positionInAll = -1;
                for (let i = allSkinsInGrade.length - 1; i >= 0; i--) {
                    if (allSkinsInGrade[i].originalName === skin.originalName && 
                        allSkinsInGrade[i].wear === skin.wear) {
                        positionInAll = i;
                        break;
                    }
                }
                
                // 原始位置是从1开始计数的
                skin.originalPosition = positionInAll !== -1 ? (positionInAll + 1) : 0;
            });
        }
        
        let skinListHtml = '<div class="tradeup-skin-list">';
        bestResult.group.forEach((skin, index) => {
            const colorClass = this.getCrateColorClass(skin.crate, true);
            skinListHtml += `
                <div class="tradeup-skin-item ${colorClass}">
                    <div class="tradeup-skin-main">
                        <div class="tradeup-skin-name">
                            <span class="tradeup-order">#${index + 1}</span>
                            ${skin.skin}
                        </div>
                        <div class="tradeup-skin-details">
                            <div class="tradeup-skin-info-line">
                                <span class="tradeup-skin-crate">${skin.crate}</span>
                                <span class="tradeup-skin-order-info">原始位置：${skin.originalPosition}</span>
                            </div>
                        </div>
                    </div>
                    <div class="tradeup-skin-wear">${skin.wear}</div>
                </div>
            `;
        });
        skinListHtml += '</div>';
        
        resultDiv.className = 'tradeup-result success';
        resultDiv.innerHTML = `
            <div class="tradeup-summary">
                <div class="tradeup-summary-title">✅ 找到最佳组合！</div>
                <div class="tradeup-summary-details">
                    <div><span class="summary-label">目标产物:</span> <span class="summary-value">${targetSkin.name}</span></div>
                    <div><span class="summary-label">目标磨损:</span> <span class="summary-value">${targetWearValue.toFixed(6)}</span></div>
                    <div><span class="summary-label">结果磨损:</span> <span class="summary-value highlight">${resultingWear.toFixed(6)}</span></div>
                </div>
            </div>
            ${skinListHtml}
        `;
        
        // 添加动画效果
        resultDiv.classList.add('show');
        
        // 保存当前结果并启用确认和复制按钮
        this.currentTradeupResult = {
            skins: bestResult.group,
            targetSkin: targetSkin,
            targetWear: targetWearValue,
            resultingWear: resultingWear
        };
        
        const confirmBtn = document.getElementById('tradeupConfirmBtn');
        const copyScriptBtn = document.getElementById('tradeupCopyScriptBtn');
        if (confirmBtn && copyScriptBtn) {
            confirmBtn.disabled = false;
            copyScriptBtn.disabled = false;
        }
    },
    

    

    


    // 计算考虑删除顺序后的当前顺序号（基于数据文件位置）
    calculateCurrentOrders: function(selectedSkins) {
        if (!window.processedSkinsData || !window.processedSkinsData.skins) {
            return selectedSkins.map(skin => ({
                ...skin,
                dataFileOrder: 0,
                currentOrder: 0
            }));
        }
        
        // 创建副本
        const result = selectedSkins.map(skin => ({
            ...skin,
            dataFileOrder: skin.dataFileOrder || 0,
            currentOrder: skin.dataFileOrder || 0
        }));
        
        // 按照数据文件位置排序
        result.sort((a, b) => a.dataFileOrder - b.dataFileOrder);
        
        // 计算当前顺序：所有被选中的皮肤都会被依次删除
        // 当前顺序 = 数据文件位置 - 前面所有被选中皮肤的数量
        for (let i = 0; i < result.length; i++) {
            const currentSkin = result[i];
            
            // 前面有多少个皮肤（所有被选中的皮肤都会被删除）
            currentSkin.currentOrder = currentSkin.dataFileOrder - i;
        }
        
        return result;
    },

    // 确认并清空
    confirmAndClear: function() {
        if (!this.currentTradeupResult) {
            return;
        }
        
        const skinsToRemove = this.currentTradeupResult.skins;
        const targetSkin = this.currentTradeupResult.targetSkin;
        
        // 从processedData.matched中删除这10个皮肤
        if (this.processedData && this.processedData.matched) {
            // 创建一个Set来存储要删除的皮肤的唯一标识
            const skinsToRemoveSet = new Set(skinsToRemove.map(s => `${s.skin}-${s.wear}`));
            
            // 过滤掉要删除的皮肤
            this.processedData.matched = this.processedData.matched.filter(skin => {
                return !skinsToRemoveSet.has(`${skin.skin}-${skin.wear}`);
            });
            
            // 更新summary
            this.processedData.summary.totalMatched = this.processedData.matched.length;
            this.processedData.summary.totalUnmatched = this.processedData.unmatched.length;
            this.processedData.summary.matchRate = this.processedData.summary.totalProcessed > 0 ? 
                (this.processedData.summary.totalMatched / this.processedData.summary.totalProcessed * 100).toFixed(2) : 0;
            
            // 更新window对象上的数据
            window.userProcessedData = this.processedData;
        }
        
        // 从originalSkinsData中删除选中的10个皮肤
        if (window.originalSkinsData && window.originalSkinsData.skins) {
            // 创建一个Set来存储要删除的皮肤的唯一标识
            const skinsToRemoveSet = new Set(skinsToRemove.map(s => `${s.originalName}-${s.wear}`));
            
            // 过滤掉要删除的皮肤
            window.originalSkinsData.skins = window.originalSkinsData.skins.filter(skin => {
                return !skinsToRemoveSet.has(`${skin.originalName}-${skin.wear}`);
            });
            
            // 添加上级皮肤到最前面
            if (targetSkin) {
                const upperGradeSkin = {
                    originalName: '合成产物',
                    processedName: '合成产物',
                    wear: 0.111111111,
                    grade: targetSkin.grade
                };
                window.originalSkinsData.skins.unshift(upperGradeSkin);
            }
        }
        
        // 立即清空汰换结果
        const resultDiv = document.getElementById('tradeupResult');
        resultDiv.classList.remove('show');
        resultDiv.className = 'tradeup-result';
        resultDiv.innerHTML = '';
        
        // 禁用确认、复制和取消汰换按钮
        const confirmBtn = document.getElementById('tradeupConfirmBtn');
        const copyScriptBtn = document.getElementById('tradeupCopyScriptBtn');
        const rollbackBtn = document.getElementById('tradeupRollbackBtn');
        if (confirmBtn && copyScriptBtn && rollbackBtn) {
            confirmBtn.disabled = true;
            copyScriptBtn.disabled = true;
            rollbackBtn.disabled = true;
        }
        
        // 清空备份数据（表示已经确认，无法取消）
        this.backupData = null;
        
        // 重置筛选下拉框
        const crateSelect = document.getElementById('crateSelect');
        const gradeSelect = document.getElementById('gradeSelect');
        const skinSelect = document.getElementById('skinSelect');
        if (crateSelect) crateSelect.value = '';
        if (gradeSelect) gradeSelect.value = '';
        if (skinSelect) skinSelect.value = '';
        
        // 更新皮肤库存显示
        const importResults = document.getElementById('importResults');
        this.displayResults(this.processedData.matched, importResults, 'matched');
        
        // 更新汇总信息显示
        this.displaySummaryCompact(this.processedData);
        
        // 更新武器箱/收藏品列表
        this.renderCrateList();
    },

    // 从左侧获取目标产物数据
    fetchFromLeft: function() {
        const resultDiv = document.getElementById('tradeupResult');
        resultDiv.className = 'tradeup-result';
        resultDiv.innerHTML = '';
        
        // 检查左侧是否有state对象和选中的皮肤
        if (typeof state === 'undefined') {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 无法获取左侧数据';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        if (!state.selectedSkin) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 请先在左侧选择一个皮肤';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        if (typeof state.wearValue === 'undefined' || state.wearValue === null) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 请先在左侧输入磨损值';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        // 填充目标产物名字
        const targetSkinNameInput = document.getElementById('targetSkinName');
        targetSkinNameInput.value = state.selectedSkin.name;
        
        // 填充目标产物磨损值
        const targetWearValueInput = document.getElementById('targetWearValue');
        targetWearValueInput.value = state.wearValue.toFixed(6);
        
        resultDiv.className = 'tradeup-result success';
        resultDiv.innerHTML = `
            <div style="font-weight: 700;">✅ 已获取目标产物数据！</div>
            <div>目标产物: ${state.selectedSkin.name}</div>
            <div>目标磨损: ${state.wearValue.toFixed(6)}</div>
        `;
        
        // 添加动画效果
        setTimeout(() => {
            resultDiv.classList.add('show');
        }, 10);
    },

    // 生成自动脚本内容
    generateAutoScript: function() {
        // 如果是快速汰换模式且有多个结果，生成合并脚本
        if (this.quickTradeupResults && this.quickTradeupResults.length > 1) {
            return this.generateQuickTradeupScript();
        }
        
        // 单个结果的原有逻辑
        return this.generateSingleScript();
    },
    
    // 生成单个汰换脚本
    generateSingleScript: function() {
        if (!this.currentTradeupResult || !this.currentTradeupResult.skins) {
            return '';
        }
        
        const skins = this.currentTradeupResult.skins;
        let scriptContent = '# 自动生成的汰换脚本\n';
        
        // 添加固定操作 - 鼠标移动
        scriptContent += '# 固定操作 鼠标移动\n';
        scriptContent += 'move coord1 0.1\n';
        scriptContent += 'wait 1\n\n';
        
        // 创建即时筛选数据映射
        const instantFilteredSkinsMap = {};
        // 为每个皮肤级别创建初始筛选数据（包含所有皮肤）
        const allGrades = [...new Set(skins.map(skin => skin.grade))];
        allGrades.forEach(grade => {
            instantFilteredSkinsMap[grade] = window.originalSkinsData.skins.filter(s => 
                s.grade === grade
            );
        });
        
        skins.forEach((skin, skinIndex) => {
            const originalPosition = skin.originalPosition || 0;
            if (originalPosition === 0) {
                scriptContent += `# 皮肤${skinIndex + 1}: 无法获取原始位置\n\n`;
                return;
            }
            
            scriptContent += `# 皮肤${skinIndex + 1}: 原始位置 ${originalPosition}\n`;
            
            // 检查是否有原始皮肤数据
            if (!window.originalSkinsData || !window.originalSkinsData.skins) {
                scriptContent += `# 无法获取完整皮肤列表\n\n`;
                return;
            }
            
            // 获取当前皮肤级别的即时筛选数据
            let instantFilteredSkins = instantFilteredSkinsMap[skin.grade];
            if (!instantFilteredSkins) {
                // 如果该级别的筛选数据不存在，重新创建
                instantFilteredSkins = window.originalSkinsData.skins.filter(s => 
                    s.grade === skin.grade
                );
                instantFilteredSkinsMap[skin.grade] = instantFilteredSkins;
            }
            
            // 计算即时位置
            let instantPosition;
            let positionSource = '';
            
            // 添加皮肤数据结构调试信息
            scriptContent += `# 调试: 皮肤${skinIndex + 1} 数据 - name: ${skin.name}, grade: ${skin.grade}, wear: ${skin.wear || '无'}, float: ${skin.float || '无'}\n`;
            
            if (skinIndex === 0) {
                // 序号1使用筛选前的皮肤位置（原始位置）
                instantPosition = originalPosition;
                positionSource = '筛选前位置';
            } else {
                // 序号2-10使用在当前筛选皮肤数据中的位置
                // 尝试根据磨损值匹配，如果没有则使用名字匹配
                let skinIndexInFiltered = -1;
                
                if (skin.wear !== undefined) {
                    // 根据磨损值匹配
                    skinIndexInFiltered = instantFilteredSkins.findIndex(s => s.wear === skin.wear);
                } else if (skin.float !== undefined) {
                    // 根据float值匹配
                    skinIndexInFiltered = instantFilteredSkins.findIndex(s => s.float === skin.float);
                } else {
                    // 回退到名字匹配
                    skinIndexInFiltered = instantFilteredSkins.findIndex(s => s.name === skin.name);
                }
                
                if (skinIndexInFiltered === -1) {
                    // 如果在筛选数据中找不到皮肤，使用原始位置作为备用方案
                    instantPosition = originalPosition;
                    positionSource = '原始位置(备用)';
                } else {
                    instantPosition = skinIndexInFiltered + 1;
                    positionSource = '即时位置';
                }
            }
            
            // 计算16个为一组
            const groupSize = 16;
            // 序号1使用原始皮肤总数，序号2-10使用即时筛选数据数量
            const useTotalSkins = skinIndex === 0 ? window.originalSkinsData.skins.length : instantFilteredSkins.length;
            const totalGroups = Math.ceil(useTotalSkins / groupSize);
            const skinGroup = Math.ceil(instantPosition / groupSize);
            const isLastGroup = skinGroup === totalGroups;
            
            // 调试信息
            scriptContent += `# 调试: 序号${skinIndex + 1} 即时位置=${instantPosition}(${positionSource}), 使用总数=${useTotalSkins}, 总组数=${totalGroups}, 皮肤组=${skinGroup}, 是否最后一组=${isLastGroup}\n`;
            
            if (isLastGroup) {
                // 最后一组的情况
                scriptContent += 'wheel up 60000\n';
                scriptContent += 'wait 0.5\n';
                
                // 计算最后一组的皮肤数量
                const skinsInLastGroup = useTotalSkins - (totalGroups - 1) * groupSize;
                
                // 计算皮肤在组内的位置
                const positionInGroup = instantPosition - (totalGroups - 1) * groupSize;
                
                // 根据最后一组的数量计算偏移
                let offset = 0;
                if (skinsInLastGroup > 12) {
                    offset = 0;
                } else if (skinsInLastGroup > 8) {
                    offset = 4;
                } else if (skinsInLastGroup > 4) {
                    offset = 8;
                } else {
                    offset = 12;
                }
                
                // 修复坐标计算：从1开始计数，而不是从0
                const finalCoordPosition = positionInGroup + offset;
                const coordNum = Math.min(Math.max(finalCoordPosition, 1), 16);
                
                scriptContent += `# 调试: 最后一组皮肤数量=${skinsInLastGroup}, 组内位置=${positionInGroup}, 偏移=${offset}, 最终坐标=${coordNum}\n`;
                scriptContent += `move coord${coordNum} 0.1\n`;
                scriptContent += 'click left 1\n';
                scriptContent += 'wait 0.5\n';
                scriptContent += 'wheel down 60000\n';
                scriptContent += 'wait 0.5\n';
            } else {
                // 不是最后一组的情况
                let remaining = instantPosition;
                
                // 收集所有wheel命令
                const wheelCommands = [];
                
                if (remaining > 64) {
                    let scroll64Count = Math.floor(remaining / 64);
                    if (remaining % 64 === 0) {
                        scroll64Count -= 1;
                    }
                    for (let i = 0; i < scroll64Count; i++) {
                        wheelCommands.push('wheel up 3800');
                    }
                    remaining = remaining % 64;
                    if (remaining === 0) {
                        remaining = 64;
                    }
                }
                
                if (remaining > 16) {
                    let scroll16Count = Math.floor(remaining / 16);
                    if (remaining % 16 === 0) {
                        scroll16Count -= 1;
                    }
                    for (let i = 0; i < scroll16Count; i++) {
                        wheelCommands.push('wheel up 960');
                    }
                    remaining = remaining % 16;
                    if (remaining === 0) {
                        remaining = 16;
                    }
                }
                
                // 合并重复的wheel命令，将数值相加
                const mergedCommands = [];
                
                for (const cmd of wheelCommands) {
                    const match = cmd.match(/^wheel up (\d+)$/);
                    if (match) {
                        const value = parseInt(match[1]);
                        
                        if (mergedCommands.length > 0) {
                            const lastCmd = mergedCommands[mergedCommands.length - 1];
                            const lastMatch = lastCmd.match(/^wheel up (\d+)$/);
                            
                            if (lastMatch) {
                                // 合并数值
                                const lastValue = parseInt(lastMatch[1]);
                                mergedCommands[mergedCommands.length - 1] = `wheel up ${lastValue + value}`;
                                continue;
                            }
                        }
                    }
                    
                    mergedCommands.push(cmd);
                }
                
                // 输出命令，每个wheel后面加wait 0.5
                for (const cmd of mergedCommands) {
                    scriptContent += cmd + '\n';
                    scriptContent += 'wait 0.5\n';
                }
                
                if (remaining > 0) {
                    // 修复：对于非最后一组，坐标应该是皮肤在组内的位置
                    const positionInGroup = (instantPosition - 1) % groupSize + 1;
                    const coordNum = positionInGroup;
                    scriptContent += `# 调试: 非最后一组, 组内位置=${positionInGroup}, 最终坐标=${coordNum}\n`;
                    scriptContent += `move coord${coordNum} 0.1\n`;
                }
                
                scriptContent += 'click left 1\n';
                scriptContent += 'wait 0.5\n';
                scriptContent += 'wheel down 60000\n';
                scriptContent += 'wait 0.5\n';
            }
        
        // 从即时筛选数据中删除当前皮肤
        if (instantFilteredSkinsMap[skin.grade]) {
            // 找到并删除当前皮肤，根据磨损值匹配
            instantFilteredSkinsMap[skin.grade] = instantFilteredSkinsMap[skin.grade].filter(s => {
                if (skin.wear !== undefined && s.wear !== undefined) {
                    return s.wear !== skin.wear;
                } else if (skin.float !== undefined && s.float !== undefined) {
                    return s.float !== skin.float;
                } else {
                    return s.name !== skin.name;
                }
            });
        }
        
        scriptContent += '\n';
        });
        
        // 添加固定操作 - 最后确认
        scriptContent += '# 固定操作\n';
        scriptContent += 'move coord17 0.1\n';
        scriptContent += 'click left 1\n';
        scriptContent += 'wait 0.5\n';
        // scriptContent += 'move coord18 0.1\n';
        // scriptContent += 'click left 1\n';
        // scriptContent += 'wait 0.5\n';
        
        return scriptContent;
    },
    
    // 生成快速汰换的合并脚本
    generateQuickTradeupScript: function() {
        if (!this.quickTradeupResults || this.quickTradeupResults.length === 0) {
            return '';
        }
        
        let scriptContent = '# 快速汰换自动脚本 - 合并多次执行\n';
        scriptContent += `# 共 ${this.quickTradeupResults.length} 次汰换\n\n`;
        
        // 为每个结果生成脚本
        this.quickTradeupResults.forEach((result, resultIndex) => {
            scriptContent += `# 第 ${resultIndex + 1} 次汰换\n`;
            scriptContent += `# 目标产物: ${result.targetSkin.name}, 目标磨损: ${result.targetWear.toFixed(6)}, 结果磨损: ${result.resultingWear.toFixed(6)}\n`;
            
            // 临时设置当前结果，以便使用原有的脚本生成逻辑
            const originalCurrentResult = this.currentTradeupResult;
            this.currentTradeupResult = result;
            
            // 生成单个脚本（避免递归调用）
            const singleScript = this.generateSingleScript();
            
            // 恢复原始结果
            this.currentTradeupResult = originalCurrentResult;
            
            // 移除单个脚本中的固定操作部分（我们会在最后统一添加）
            const lines = singleScript.split('\n');
            let filteredScript = '';
            let inFixedSection = false;
            
            for (const line of lines) {
                if (line.includes('# 固定操作')) {
                    inFixedSection = true;
                    continue;
                }
                if (inFixedSection && line.trim() === '') {
                    inFixedSection = false;
                    continue;
                }
                if (!inFixedSection) {
                    filteredScript += line + '\n';
                }
            }
            
            scriptContent += filteredScript;
            
            // 如果不是最后一次，添加确认操作
            if (resultIndex < this.quickTradeupResults.length - 1) {
                scriptContent += '# 确认本次汰换\n';
                scriptContent += 'move coord17 0.1\n';
                scriptContent += 'click left 1\n';
                scriptContent += 'wait 0.5\n';
                scriptContent += '# 等待界面刷新\n';
                scriptContent += 'wait 2\n\n';
            }
        });
        
        // 添加最终的固定操作
        scriptContent += '# 最终确认\n';
        scriptContent += 'move coord17 0.1\n';
        scriptContent += 'click left 1\n';
        scriptContent += 'wait 0.5\n';
        
        return scriptContent;
    },

    // 复制自动脚本到剪贴板
    copyAutoScript: function() {
        const scriptContent = this.generateAutoScript();
        const copyBtn = document.getElementById('tradeupCopyScriptBtn');
        const originalText = copyBtn.textContent;
        
        if (!scriptContent) {
            if (copyBtn) {
                copyBtn.textContent = '没有内容';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }
            return;
        }
        
        const doCopy = () => {
            if (copyBtn) {
                copyBtn.textContent = '已复制';
                setTimeout(() => {
                    copyBtn.textContent = originalText;
                }, 1500);
            }
        };
        
        navigator.clipboard.writeText(scriptContent).then(() => {
            doCopy();
        }).catch(err => {
            console.error('复制失败:', err);
            const textArea = document.createElement('textarea');
            textArea.value = scriptContent;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                doCopy();
            } catch (e) {
                if (copyBtn) {
                    copyBtn.textContent = '复制失败';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                    }, 1500);
                }
            }
            document.body.removeChild(textArea);
        });
    },
    
    // 保存目标产物记录
    saveTradeupRecord: function() {
        const targetSkinName = document.getElementById('targetSkinName').value.trim();
        const targetWearValue = document.getElementById('targetWearValue').value.trim();
        const targetMinWearValue = document.getElementById('targetMinWearValue').value.trim();
        
        if (!targetSkinName || !targetWearValue || !targetMinWearValue) {
            alert('请先填写完整的目标产物信息');
            return;
        }
        
        // 检查是否已存在相同记录
        const existingRecord = this.savedTradeupRecords.find(record => 
            record.name === targetSkinName && 
            record.wear === targetWearValue && 
            record.minWear === targetMinWearValue
        );
        
        if (existingRecord) {
            alert('该记录已存在');
            return;
        }
        
        // 添加新记录
        const newRecord = {
            id: Date.now(),
            name: targetSkinName,
            wear: targetWearValue,
            minWear: targetMinWearValue
        };
        
        this.savedTradeupRecords.push(newRecord);
        this.saveToLocalStorage();
        this.renderSavedRecords();
        
        // 显示保存记录区域
        const savedRecords = document.getElementById('tradeupSavedRecords');
        if (savedRecords) {
            savedRecords.style.display = 'block';
        }
        
        alert('记录保存成功！');
    },
    
    // 渲染保存的记录
    renderSavedRecords: function() {
        const recordsList = document.getElementById('tradeupRecordsList');
        if (!recordsList) return;
        
        recordsList.innerHTML = this.savedTradeupRecords.map(record => `
            <div class="tradeup-record-item" onclick="UserInventoryEnhanced.loadTradeupRecord(${record.id})">
                <div class="tradeup-record-info">
                    <span class="tradeup-record-name">${record.name}</span>
                    <span class="tradeup-record-wear">磨损: ${record.wear}</span>
                    <span class="tradeup-record-minwear">最低: ${record.minWear}</span>
                </div>
                <div class="tradeup-record-actions">
                    <button class="tradeup-record-delete" onclick="event.stopPropagation(); UserInventoryEnhanced.deleteTradeupRecord(${record.id})">删除</button>
                </div>
            </div>
        `).join('');
    },
    
    // 加载保存的记录
    loadTradeupRecord: function(recordId) {
        const record = this.savedTradeupRecords.find(r => r.id === recordId);
        if (!record) return;
        
        document.getElementById('targetSkinName').value = record.name;
        document.getElementById('targetWearValue').value = record.wear;
        document.getElementById('targetMinWearValue').value = record.minWear;
    },
    
    // 删除保存的记录
    deleteTradeupRecord: function(recordId) {
        this.savedTradeupRecords = this.savedTradeupRecords.filter(r => r.id !== recordId);
        this.saveToLocalStorage();
        this.renderSavedRecords();
        
        // 如果没有记录，隐藏保存记录区域
        if (this.savedTradeupRecords.length === 0) {
            const savedRecords = document.getElementById('tradeupSavedRecords');
            if (savedRecords) {
                savedRecords.style.display = 'none';
            }
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 初始化UserInventoryEnhanced
    UserInventoryEnhanced.init();
    
    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
        processBtn.addEventListener('click', function() {
            UserInventoryEnhanced.handlePasteAndProcess();
        });
    }
    
    const tradeupBtn = document.getElementById('tradeupBtn');
    if (tradeupBtn) {
        tradeupBtn.addEventListener('click', function() {
            UserInventoryEnhanced.executeTradeup();
        });
    }
    

    
    const tradeupConfirmBtn = document.getElementById('tradeupConfirmBtn');
    if (tradeupConfirmBtn) {
        tradeupConfirmBtn.addEventListener('click', function() {
            UserInventoryEnhanced.confirmAndClear();
        });
    }
    
    const tradeupQuickBtn = document.getElementById('tradeupQuickBtn');
    if (tradeupQuickBtn) {
        tradeupQuickBtn.addEventListener('click', function() {
            UserInventoryEnhanced.quickTradeup();
        });
    }
    
    const tradeupRollbackBtn = document.getElementById('tradeupRollbackBtn');
    if (tradeupRollbackBtn) {
        tradeupRollbackBtn.addEventListener('click', function() {
            UserInventoryEnhanced.rollbackData();
        });
    }
    
    const tradeupFetchBtn = document.getElementById('tradeupFetchBtn');
    if (tradeupFetchBtn) {
        tradeupFetchBtn.addEventListener('click', function() {
            UserInventoryEnhanced.fetchFromLeft();
        });
    }
    
    const tradeupSaveBtn = document.getElementById('tradeupSaveBtn');
    if (tradeupSaveBtn) {
        tradeupSaveBtn.addEventListener('click', function() {
            UserInventoryEnhanced.saveTradeupRecord();
        });
    }
    
    // 数量控制开关事件
    const useQuantityControl = document.getElementById('useQuantityControl');
    if (useQuantityControl) {
        useQuantityControl.addEventListener('change', function() {
            UserInventoryEnhanced.toggleCrateQuantitySection();
        });
    }
    
    const tradeupPopupBtn = document.getElementById('tradeupPopupBtn');
    if (tradeupPopupBtn) {
        tradeupPopupBtn.addEventListener('click', function() {
            UserInventoryEnhanced.showTradeupPopup();
        });
    }
    
    const testPopupBtn = document.getElementById('testPopupBtn');
    if (testPopupBtn) {
        testPopupBtn.addEventListener('click', function() {
            UserInventoryEnhanced.showTradeupPopup();
        });
    }
    
    const tradeupPopupClose = document.getElementById('tradeupPopupClose');
    const tradeupPopup = document.getElementById('tradeupPopup');
    
    if (tradeupPopupClose && tradeupPopup) {
        tradeupPopupClose.addEventListener('click', function() {
            UserInventoryEnhanced.hideTradeupPopup();
        });
    }
    
    if (tradeupPopup) {
        tradeupPopup.addEventListener('click', function(e) {
            if (e.target === tradeupPopup) {
                UserInventoryEnhanced.hideTradeupPopup();
            }
        });
    }
    
    // 帮助图标点击事件
    const helpIcon = document.getElementById('helpIcon');
    const helpModal = document.getElementById('helpModal');
    const helpModalClose = document.getElementById('helpModalClose');
    
    if (helpIcon && helpModal) {
        helpIcon.addEventListener('click', function() {
            helpModal.classList.add('show');
        });
    }
    
    if (helpModalClose && helpModal) {
        helpModalClose.addEventListener('click', function() {
            helpModal.classList.remove('show');
        });
    }
    
    // 点击模态框外部关闭
    if (helpModal) {
        helpModal.addEventListener('click', function(e) {
            if (e.target === helpModal) {
                helpModal.classList.remove('show');
            }
        });
    }
    
    // 处理结果展开/收起功能
    const resultsToggle = document.getElementById('resultsToggle');
    const resultsContent = document.getElementById('resultsContent');
    
    if (resultsToggle && resultsContent) {
        resultsToggle.addEventListener('click', function() {
            const isCollapsed = resultsContent.classList.contains('collapsed');
            
            if (isCollapsed) {
                // 展开
                resultsContent.classList.remove('collapsed');
                resultsToggle.textContent = '▼';
                resultsToggle.classList.remove('collapsed');
            } else {
                // 收起
                resultsContent.classList.add('collapsed');
                resultsToggle.textContent = '▶';
                resultsToggle.classList.add('collapsed');
            }
        });
        
        // 点击标题也可以展开/收起
        const resultsHeader = document.querySelector('.results-header');
        if (resultsHeader) {
            resultsHeader.addEventListener('click', function(e) {
                if (e.target !== resultsToggle) {
                    resultsToggle.click();
                }
            });
        }
    }
    
    const tradeupCopyScriptBtn = document.getElementById('tradeupCopyScriptBtn');
    if (tradeupCopyScriptBtn) {
        tradeupCopyScriptBtn.addEventListener('click', function() {
            UserInventoryEnhanced.copyAutoScript();
        });
    }
});



// 显示处理结果弹出框
UserInventoryEnhanced.showProcessResultPopup = function(results) {
    const matchedCount = results.matched ? results.matched.length : 0;
    const unmatchedCount = results.unmatched ? results.unmatched.length : 0;
    const totalCount = matchedCount + unmatchedCount;
    
    // 获取去重的未匹配皮肤名字
    const unmatchedSkinNames = this.getUniqueUnmatchedSkinNames(results.unmatched);
    
    // 判断是否有未匹配的皮肤
    const hasUnmatched = unmatchedCount > 0;
    
    // 创建弹出框内容
    let popupContent = '';
    
    if (hasUnmatched) {
        // 有未匹配皮肤的情况 - 需要手动关闭
        popupContent = `
            <div style="text-align: center; padding: 20px;">
                <h3 style="color: #dc3545; margin-bottom: 15px;">⚠️ 处理完成（有未匹配皮肤）</h3>
                <div style="font-size: 16px; margin-bottom: 10px;">
                    <strong>处理结果汇总：</strong>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>总皮肤数量：</span>
                        <span style="font-weight: bold;">${totalCount}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #28a745;">✅ 匹配成功：</span>
                        <span style="color: #28a745; font-weight: bold;">${matchedCount}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #dc3545;">❌ 未匹配：</span>
                        <span style="color: #dc3545; font-weight: bold;">${unmatchedCount}</span>
                    </div>
                </div>
                <div style="text-align: left; margin-bottom: 15px;">
                    <div style="color: #dc3545; font-weight: bold; margin-bottom: 8px;">未匹配皮肤：</div>
                    <div style="max-height: 200px; overflow-y: auto; background: #fff5f5; padding: 15px; border-radius: 6px; font-size: 14px; line-height: 1.4;">
                        ${unmatchedSkinNames.map(name => `<div style="margin-bottom: 6px; word-break: break-word; white-space: normal;">• ${name}</div>`).join('')}
                    </div>
                </div>
                <div style="font-size: 14px; color: #6c757d; margin-bottom: 15px;">
                    请勿使用自动脚本，未匹配的皮肤名字可以反馈一下
                </div>
                <div style="font-size: 12px; color: #6c757d;">
                    点击任意区域外关闭提示框
                </div>
            </div>
        `;
    } else {
        // 全部匹配成功的情况 - 2秒自动关闭
        popupContent = `
            <div style="text-align: center; padding: 20px;">
                <h3 style="color: #28a745; margin-bottom: 15px;">✅ 处理完成（全部匹配成功）</h3>
                <div style="font-size: 16px; margin-bottom: 10px;">
                    <strong>处理结果汇总：</strong>
                </div>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span>总皮肤数量：</span>
                        <span style="font-weight: bold;">${totalCount}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #28a745;">✅ 匹配成功：</span>
                        <span style="color: #28a745; font-weight: bold;">${matchedCount}</span>
                    </div>
                </div>
                <div style="font-size: 12px; color: #6c757d; margin-bottom: 15px;">
                    若匹配数量与预期数量不一致，请勿使用自动脚本，检查是否有皮肤没有磨损值
                </div>
                <div style="font-size: 12px; color: #6c757d;">
                    点击任意区域外关闭提示框
                </div>
            </div>
        `;
    }
    
    // 创建弹出框
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    popup.innerHTML = `
        <div style="
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
            animation: fadeIn 0.3s ease;
        ">
            ${popupContent}
        </div>
    `;
    
    // 添加淡入动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.9); }
            to { opacity: 1; transform: scale(1); }
        }
    `;
    document.head.appendChild(style);
    
    // 点击背景关闭（只有有未匹配皮肤时才允许点击背景关闭）
    if (hasUnmatched) {
        popup.addEventListener('click', function(e) {
            if (e.target === popup) {
                popup.remove();
            }
        });
    }
    
    // 添加到页面
    document.body.appendChild(popup);
    
    // 统一关闭方式：点击背景关闭
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            popup.remove();
        }
    });
};

// 获取去重的未匹配皮肤名字
UserInventoryEnhanced.getUniqueUnmatchedSkinNames = function(unmatchedSkins) {
    if (!unmatchedSkins || unmatchedSkins.length === 0) {
        return [];
    }
    
    // 提取皮肤名字并去重
    const skinNames = unmatchedSkins.map(skin => {
        // 直接从 originalName 属性获取完整的皮肤名字
        if (skin.originalName) {
            return skin.originalName;
        }
        
        // 如果 originalName 不存在，尝试 processedName
        if (skin.processedName) {
            return skin.processedName;
        }
        
        // 如果都没有，返回未知皮肤
        return '未知皮肤';
    });
    
    // 去重
    return [...new Set(skinNames)];
};

// 初始化武器箱/收藏品选择功能
UserInventoryEnhanced.initCrateSelection = function() {
    // 全选和取消全选功能已移除
};

// 渲染武器箱/收藏品列表
UserInventoryEnhanced.renderCrateList = function() {
    const crateList = document.getElementById('crateCollectionList');
    if (!crateList || !this.processedData || !this.processedData.matched) {
        return;
    }
    
    // 获取所有独特的武器箱/收藏品
    const uniqueCrates = [...new Set(this.processedData.matched.map(skin => skin.crate))];
    
    // 清理掉不存在的武器箱/收藏品的选择状态
    const newSelectedCrates = {};
    uniqueCrates.forEach(crate => {
        if (this.selectedCrates.hasOwnProperty(crate)) {
            newSelectedCrates[crate] = this.selectedCrates[crate];
        } else {
            newSelectedCrates[crate] = false; // 新出现的默认不选中
        }
    });
    this.selectedCrates = newSelectedCrates;
    
    // 清空并重置颜色映射
    crateList.innerHTML = '';
    this.crateColorMap = {};
    
    // 为每个武器箱/收藏品分配颜色
    uniqueCrates.forEach((crate, index) => {
        const colorIndex = index % this.crateColors.length;
        this.crateColorMap[crate] = {
            crateColor: this.crateColors[colorIndex],
            resultColor: this.resultCrateColors[colorIndex],
            colorIndex: colorIndex + 1
        };
        
        // 创建武器箱/收藏品项
        const crateItem = document.createElement('div');
        crateItem.className = `crate-item ${this.crateColors[colorIndex]}`;
        crateItem.dataset.crate = crate;
        
        if (this.selectedCrates[crate]) {
            crateItem.classList.add('selected');
        }
        
        crateItem.innerHTML = `
            <div class="crate-checkbox">
                <span class="crate-checkmark">✓</span>
            </div>
            <div class="crate-name">${crate}</div>
        `;
        
        // 点击切换选择状态
        crateItem.addEventListener('click', () => this.toggleCrateSelection(crate));
        
        crateList.appendChild(crateItem);
    });
};

// 切换武器箱/收藏品选择状态
UserInventoryEnhanced.toggleCrateSelection = function(crate) {
    this.selectedCrates[crate] = !this.selectedCrates[crate];
    
    const crateItem = document.querySelector(`.crate-item[data-crate="${crate}"]`);
    if (crateItem) {
        if (this.selectedCrates[crate]) {
            crateItem.classList.add('selected');
        } else {
            crateItem.classList.remove('selected');
        }
    }
    
    // 更新武器箱数量设置区域
    this.toggleCrateQuantitySection();
};







// 获取选中的武器箱/收藏品的皮肤数据
UserInventoryEnhanced.getFilteredSkins = function() {
    if (!this.processedData || !this.processedData.matched) {
        return [];
    }
    
    return this.processedData.matched.filter(skin => {
        return this.selectedCrates[skin.crate] === true;
    });
};

// 获取武器箱/收藏品的颜色类
UserInventoryEnhanced.getCrateColorClass = function(crate, isResult = false) {
    if (this.crateColorMap[crate]) {
        return isResult ? this.crateColorMap[crate].resultColor : this.crateColorMap[crate].crateColor;
    }
    return isResult ? 'tradeup-result-crate-1' : 'crate-color-1';
};



// 显示/隐藏武器箱数量设置区域
UserInventoryEnhanced.toggleCrateQuantitySection = function() {
    const quantitySection = document.getElementById('crateQuantitySection');
    const quantityList = document.getElementById('crateQuantityList');
    const useQuantityControl = document.getElementById('useQuantityControl');
    
    if (!this.processedData || !this.processedData.matched) return;
    
    const uniqueCrates = [...new Set(this.processedData.matched.map(skin => skin.crate))];
    const selectedCrates = uniqueCrates.filter(crate => this.selectedCrates[crate]);
    
    // 数量设置区域一直显示，但内容区域根据开关状态显示/隐藏
    quantitySection.style.display = 'block';
    
    // 如果开启了数量控制且选中了武器箱，显示数量设置内容
    if (useQuantityControl && useQuantityControl.checked && selectedCrates.length > 0) {
        quantityList.style.display = 'flex';
        this.renderCrateQuantityList(selectedCrates);
    } else {
        quantityList.style.display = 'none';
    }
};

// 渲染武器箱数量设置列表
UserInventoryEnhanced.renderCrateQuantityList = function(selectedCrates) {
    const quantityList = document.getElementById('crateQuantityList');
    if (!quantityList) return;
    
    quantityList.innerHTML = '';
    
    // 获取目标产物武器箱
    const targetSkinName = document.getElementById('targetSkinName').value.trim();
    const targetSkin = this.findTargetSkin(targetSkinName);
    const targetCrate = targetSkin ? targetSkin.crate : null;
    
    // 计算默认分配（目标产物武器箱优先分配）
    const defaultQuantities = this.calculateDefaultQuantities(selectedCrates, targetCrate);
    
    // 检查当前选中的武器箱是否都在crateQuantities中
    let hasValidUserSetting = false;
    if (this.crateQuantities) {
        hasValidUserSetting = selectedCrates.every(crate => 
            this.crateQuantities[crate] !== undefined && this.crateQuantities[crate] > 0
        );
    }
    
    // 更新crateQuantities，只保留当前选中武器箱的数据
    const newCrateQuantities = {};
    selectedCrates.forEach(crate => {
        // 如果用户设置有效且有值，使用用户设置的值；否则使用默认值
        if (hasValidUserSetting && this.crateQuantities && this.crateQuantities[crate] > 0) {
            newCrateQuantities[crate] = this.crateQuantities[crate];
        } else {
            newCrateQuantities[crate] = defaultQuantities[crate] || 1;
        }
    });
    this.crateQuantities = newCrateQuantities;
    
    selectedCrates.forEach(crate => {
        const quantityItem = document.createElement('div');
        quantityItem.className = 'crate-quantity-item';
        
        // 获取该武器箱的可用皮肤数量
        const availableSkins = this.processedData.matched.filter(skin => 
            skin.crate === crate && skin.grade === this.getLowerGrade(this.findTargetSkin(targetSkinName).grade)
        ).length;
        
        const displayValue = this.crateQuantities[crate] || 1;
        
        quantityItem.innerHTML = `
            <div class="crate-quantity-name">${crate}</div>
            <div class="crate-quantity-controls">
                <button class="crate-quantity-btn" onclick="UserInventoryEnhanced.adjustCrateQuantity('${crate}', -1)">-</button>
                <span class="crate-quantity-value" data-crate="${crate}">${displayValue}</span>
                <button class="crate-quantity-btn" onclick="UserInventoryEnhanced.adjustCrateQuantity('${crate}', 1)">+</button>
            </div>
        `;
        
        quantityList.appendChild(quantityItem);
    });
    
    // 计算并添加总和显示
    const total = Object.values(this.crateQuantities).reduce((sum, q) => sum + q, 0);
    const totalItem = document.createElement('div');
    totalItem.className = 'crate-quantity-total';
    totalItem.innerHTML = `
        <div class="crate-quantity-name">总计</div>
        <div class="crate-quantity-sum">${total}</div>
    `;
    quantityList.appendChild(totalItem);
};

// 计算默认数量分配
UserInventoryEnhanced.calculateDefaultQuantities = function(selectedCrates, targetCrate) {
    const quantities = {};
    const crateCount = selectedCrates.length;
    
    if (crateCount === 1) {
        // 只有一个武器箱，分配10个皮肤
        quantities[selectedCrates[0]] = 10;
    } else if (crateCount === 2) {
        // 两个武器箱，目标产物武器箱优先分配更多
        if (targetCrate && selectedCrates.includes(targetCrate)) {
            quantities[targetCrate] = 7;
            const otherCrate = selectedCrates.find(c => c !== targetCrate);
            quantities[otherCrate] = 3;
        } else {
            // 没有目标产物武器箱，平均分配
            quantities[selectedCrates[0]] = 5;
            quantities[selectedCrates[1]] = 5;
        }
    } else {
        // 多个武器箱，目标产物武器箱优先分配
        let remaining = 10;
        
        // 先给目标产物武器箱分配
        if (targetCrate && selectedCrates.includes(targetCrate)) {
            quantities[targetCrate] = Math.min(4, remaining);
            remaining -= quantities[targetCrate];
        }
        
        // 给其他武器箱平均分配剩余数量
        const otherCrates = selectedCrates.filter(c => c !== targetCrate);
        const otherCount = otherCrates.length;
        
        if (otherCount > 0) {
            const baseAmount = Math.floor(remaining / otherCount);
            let extra = remaining % otherCount;
            
            otherCrates.forEach(crate => {
                quantities[crate] = baseAmount + (extra > 0 ? 1 : 0);
                if (extra > 0) extra--;
            });
        }
    }
    
    return quantities;
};

// 调整武器箱参与皮肤数量（加减号按钮）
UserInventoryEnhanced.adjustCrateQuantity = function(crate, delta) {
    if (!this.crateQuantities) {
        this.crateQuantities = {};
    }
    
    const targetSkinName = document.getElementById('targetSkinName').value.trim();
    const targetSkin = this.findTargetSkin(targetSkinName);
    const targetCrate = targetSkin ? targetSkin.crate : null;
    
    // 获取当前选中的武器箱
    const selectedCrates = Object.keys(this.selectedCrates).filter(c => this.selectedCrates[c]);
    const otherCrates = selectedCrates.filter(c => c !== crate);
    
    // 获取当前值
    const currentValue = this.crateQuantities[crate] || 0;
    let newValue = currentValue + delta;
    
    // 边界检查
    if (newValue < 1) newValue = 1;
    if (newValue > 10) newValue = 10;
    
    // 如果修改的是目标产物武器箱，确保其数量不超过10-其他武器箱数量
    if (crate === targetCrate) {
        newValue = Math.min(newValue, 10 - otherCrates.length);
    }
    
    // 如果增加导致总和超过10，则不能增加
    const otherTotal = otherCrates.reduce((sum, c) => sum + (this.crateQuantities[c] || 0), 0);
    if (newValue + otherTotal > 10) {
        newValue = 10 - otherTotal;
    }
    
    // 更新当前武器箱的数量
    this.crateQuantities[crate] = newValue;
    
    // 如果总和不足10，自动分配给其他武器箱
    const currentTotal = Object.values(this.crateQuantities).reduce((sum, q) => sum + q, 0);
    if (currentTotal < 10 && otherCrates.length > 0) {
        const remaining = 10 - newValue;
        const baseAmount = Math.floor(remaining / otherCrates.length);
        let extra = remaining % otherCrates.length;
        
        otherCrates.forEach(otherCrate => {
            this.crateQuantities[otherCrate] = Math.max(1, baseAmount + (extra > 0 ? 1 : 0));
            if (extra > 0) extra--;
        });
    }
    
    // 更新UI显示
    this.updateCrateQuantityUI();
};

// 更新武器箱数量UI显示
UserInventoryEnhanced.updateCrateQuantityUI = function() {
    const quantityValues = document.querySelectorAll('.crate-quantity-value');
    quantityValues.forEach(span => {
        const crate = span.dataset.crate;
        if (this.crateQuantities && this.crateQuantities[crate] !== undefined) {
            span.textContent = this.crateQuantities[crate];
        }
    });
    
    // 更新总计
    const totalSum = document.querySelector('.crate-quantity-sum');
    if (totalSum && this.crateQuantities) {
        const total = Object.values(this.crateQuantities).reduce((sum, q) => sum + q, 0);
        totalSum.textContent = total;
    }
};

// 新的汰换算法：控制各武器箱参与皮肤数量
UserInventoryEnhanced.executeTradeupWithQuantityControl = function(candidateSkins, targetConvertedSum) {
    if (!this.crateQuantities || Object.keys(this.crateQuantities).length === 0) {
        return this.executeTradeupOriginal(candidateSkins, targetConvertedSum);
    }
    
    // 按照武器箱分组
    const skinsByCrate = {};
    candidateSkins.forEach(skin => {
        if (!skinsByCrate[skin.crate]) {
            skinsByCrate[skin.crate] = [];
        }
        skinsByCrate[skin.crate].push(skin);
    });
    
    // 检查每个武器箱的库存皮肤数量是否足够
    const selectedCrates = Object.keys(this.crateQuantities);
    
    // 检查是否有武器箱库存皮肤数量不足
    for (const crate of selectedCrates) {
        const quantity = this.crateQuantities[crate];
        const crateSkins = skinsByCrate[crate] || [];
        
        if (crateSkins.length < quantity) {
            return {
                error: true,
                message: `❌ 武器箱"${crate}"库存皮肤数量不足 (需要${quantity}个, 当前${crateSkins.length}个)`
            };
        }
    }
    
    // 使用新的智能替换算法
    return this.smartTradeupWithQuantityControl(candidateSkins, targetConvertedSum);
};

// 智能汰换算法：先找最佳组合，再进行智能替换
UserInventoryEnhanced.smartTradeupWithQuantityControl = function(candidateSkins, targetConvertedSum) {
    // 第一步：不按武器箱分组，直接使用原始算法找到最佳组合
    const bestResult = this.executeTradeupOriginal(candidateSkins, targetConvertedSum);
    
    if (!bestResult) {
        return null; // 原始算法无法找到符合条件的组合
    }
    
    // 第二步：检查当前组合是否符合用户设置的皮肤数量要求
    const currentQuantities = this.countSkinsByCrate(bestResult.group);
    const isQuantityValid = this.validateQuantities(currentQuantities);
    
    if (isQuantityValid) {
        return bestResult; // 如果符合要求，直接返回
    }
    
    // 第三步：进行智能替换，调整皮肤数量
    return this.smartSkinReplacement(bestResult.group, candidateSkins, targetConvertedSum);
};

// 统计组合中各武器箱的皮肤数量
UserInventoryEnhanced.countSkinsByCrate = function(skins) {
    const quantities = {};
    skins.forEach(skin => {
        if (!quantities[skin.crate]) {
            quantities[skin.crate] = 0;
        }
        quantities[skin.crate]++;
    });
    return quantities;
};

// 验证皮肤数量是否符合用户设置
UserInventoryEnhanced.validateQuantities = function(currentQuantities) {
    for (const crate in this.crateQuantities) {
        const targetQuantity = this.crateQuantities[crate];
        const currentQuantity = currentQuantities[crate] || 0;
        
        if (currentQuantity !== targetQuantity) {
            return false;
        }
    }
    return true;
};

// 智能皮肤替换算法
UserInventoryEnhanced.smartSkinReplacement = function(originalGroup, allSkins, targetConvertedSum) {
    let bestGroup = [...originalGroup];
    let bestSum = bestGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
    
    // 统计当前组合中各武器箱的皮肤数量
    const currentQuantities = this.countSkinsByCrate(bestGroup);
    
    // 找出皮肤数量过多的武器箱和不足的武器箱
    const excessCrates = [];
    const deficitCrates = [];
    
    for (const crate in this.crateQuantities) {
        const targetQuantity = this.crateQuantities[crate];
        const currentQuantity = currentQuantities[crate] || 0;
        
        if (currentQuantity > targetQuantity) {
            excessCrates.push({ crate, excess: currentQuantity - targetQuantity });
        } else if (currentQuantity < targetQuantity) {
            deficitCrates.push({ crate, deficit: targetQuantity - currentQuantity });
        }
    }
    
    // 进行智能替换
    for (const excessInfo of excessCrates) {
        const { crate: excessCrate, excess } = excessInfo;
        
        // 从过多武器箱中找出转换磨损值高的皮肤
        const excessSkins = bestGroup.filter(skin => skin.crate === excessCrate)
            .sort((a, b) => b.convertedWear - a.convertedWear)
            .slice(0, excess);
        
        for (const deficitInfo of deficitCrates) {
            const { crate: deficitCrate, deficit } = deficitInfo;
            
            // 从不足武器箱中找出未被选中的皮肤（转换磨损值较低）
            const availableSkins = allSkins.filter(skin => 
                skin.crate === deficitCrate && 
                !bestGroup.includes(skin)
            );
            
            if (availableSkins.length === 0) continue;
            
            // 尝试替换
            for (const excessSkin of excessSkins) {
                for (const deficitSkin of availableSkins) {
                    // 确保替换皮肤的转换磨损值比拿出的皮肤低
                    if (deficitSkin.convertedWear >= excessSkin.convertedWear) continue;
                    
                    const tempGroup = bestGroup.map(skin => 
                        skin === excessSkin ? deficitSkin : skin
                    );
                    
                    const tempSum = tempGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
                    
                    // 检查替换后的数量是否更接近目标
                    const tempQuantities = this.countSkinsByCrate(tempGroup);
                    const isBetter = this.isQuantityBetter(tempQuantities, currentQuantities);
                    
                    // 如果符合用户设置的皮肤数量且不超过目标磨损值
                    if (tempSum <= targetConvertedSum && isBetter) {
                        bestGroup = tempGroup;
                        bestSum = tempSum;
                        
                        // 更新数量统计
                        currentQuantities[excessCrate]--;
                        currentQuantities[deficitCrate] = (currentQuantities[deficitCrate] || 0) + 1;
                        
                        // 重新检查是否还需要继续替换
                        if (this.validateQuantities(currentQuantities)) {
                            return { group: bestGroup, sum: bestSum };
                        }
                    }
                }
            }
        }
    }
    
    // 最终验证数量是否符合要求
    if (this.validateQuantities(currentQuantities)) {
        // 第四步：在符合数量要求的基础上，优化磨损值使其更接近目标
        return this.optimizeWearValue(bestGroup, allSkins, targetConvertedSum);
    }
    
    return null;
};

// 优化磨损值，使其更接近目标产物磨损值
UserInventoryEnhanced.optimizeWearValue = function(currentGroup, allSkins, targetConvertedSum) {
    let bestGroup = [...currentGroup];
    let bestSum = bestGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
    
    // 按武器箱分组
    const currentQuantities = this.countSkinsByCrate(bestGroup);
    
    // 第一阶段：优先尝试用高磨损值皮肤替换（使总和更接近目标）
    let improved = true;
    let iterations = 0;
    
    while (improved && iterations < 100) {
        improved = false;
        iterations++;
        
        // 遍历每个武器箱
        for (const crate in currentQuantities) {
            // 获取当前武器箱中选中的皮肤（按转换磨损值从低到高排序）
            const currentCrateSkins = bestGroup.filter(skin => skin.crate === crate)
                .sort((a, b) => a.convertedWear - b.convertedWear);
            
            // 获取该武器箱中未选中的皮肤（按转换磨损值从高到低排序）
            const availableCrateSkins = allSkins.filter(skin => 
                skin.crate === crate && !bestGroup.includes(skin)
            ).sort((a, b) => b.convertedWear - a.convertedWear);
            
            if (availableCrateSkins.length === 0) continue;
            
            // 尝试用高磨损值皮肤替换当前武器箱中转换磨损值最低的皮肤
            for (const currentSkin of currentCrateSkins) {
                for (const availableSkin of availableCrateSkins) {
                    // 只考虑用更高磨损值的皮肤替换
                    if (availableSkin.convertedWear <= currentSkin.convertedWear) continue;
                    
                    const tempGroup = bestGroup.map(skin => 
                        skin === currentSkin ? availableSkin : skin
                    );
                    
                    const tempSum = tempGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
                    
                    // 检查是否更接近目标且不超过目标
                    if (tempSum <= targetConvertedSum && tempSum > bestSum) {
                        bestGroup = tempGroup;
                        bestSum = tempSum;
                        improved = true;
                        break;
                    }
                }
                
                if (improved) break;
            }
        }
    }
    
    // 第二阶段：如果替换后仍低于目标，尝试更精细的调整
    if (bestSum < targetConvertedSum) {
        let bestDiff = targetConvertedSum - bestSum;
        
        // 方法1：遍历所有可能的替换组合
        for (let i = 0; i < bestGroup.length; i++) {
            const currentSkin = bestGroup[i];
            
            // 获取当前武器箱中可用的其他皮肤
            const availableSkins = allSkins.filter(skin => 
                skin.crate === currentSkin.crate && 
                !bestGroup.includes(skin)
            );
            
            for (const availableSkin of availableSkins) {
                const tempGroup = [...bestGroup];
                tempGroup[i] = availableSkin;
                
                const tempSum = tempGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
                
                // 如果不超过目标，且更接近目标
                if (tempSum <= targetConvertedSum) {
                    const diff = targetConvertedSum - tempSum;
                    if (diff < bestDiff) {
                        bestDiff = diff;
                        bestGroup = tempGroup;
                        bestSum = tempSum;
                    }
                }
            }
        }
        
        // 方法2：尝试多皮肤组合替换（如果单次替换效果不佳）
        if (bestDiff > 0.01) { // 如果差距还比较大
            // 尝试同时替换多个皮肤
            for (let i = 0; i < bestGroup.length - 1; i++) {
                for (let j = i + 1; j < bestGroup.length; j++) {
                    const skin1 = bestGroup[i];
                    const skin2 = bestGroup[j];
                    
                    // 获取两个武器箱中可用的高磨损值皮肤
                    const availableSkins1 = allSkins.filter(s => 
                        s.crate === skin1.crate && !bestGroup.includes(s)
                    ).sort((a, b) => b.convertedWear - a.convertedWear);
                    
                    const availableSkins2 = allSkins.filter(s => 
                        s.crate === skin2.crate && !bestGroup.includes(s)
                    ).sort((a, b) => b.convertedWear - a.convertedWear);
                    
                    if (availableSkins1.length === 0 || availableSkins2.length === 0) continue;
                    
                    // 尝试用两个高磨损值皮肤替换
                    for (const newSkin1 of availableSkins1.slice(0, 3)) { // 只尝试前3个最高磨损的
                        for (const newSkin2 of availableSkins2.slice(0, 3)) {
                            const tempGroup = [...bestGroup];
                            tempGroup[i] = newSkin1;
                            tempGroup[j] = newSkin2;
                            
                            const tempSum = tempGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
                            
                            if (tempSum <= targetConvertedSum) {
                                const diff = targetConvertedSum - tempSum;
                                if (diff < bestDiff) {
                                    bestDiff = diff;
                                    bestGroup = tempGroup;
                                    bestSum = tempSum;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        // 方法3：如果还有差距，尝试更激进的替换策略
        if (bestDiff > 0.001) {
            // 按武器箱分组，对每个武器箱尝试所有可能的组合
            for (const crate in currentQuantities) {
                const crateSkins = bestGroup.filter(s => s.crate === crate);
                const availableSkins = allSkins.filter(s => 
                    s.crate === crate && !bestGroup.includes(s)
                ).sort((a, b) => b.convertedWear - a.convertedWear);
                
                if (availableSkins.length === 0) continue;
                
                // 尝试替换该武器箱中的所有皮肤
                const tempGroup = bestGroup.filter(s => s.crate !== crate);
                const newCrateSkins = availableSkins.slice(0, crateSkins.length);
                
                if (newCrateSkins.length === crateSkins.length) {
                    const combinedGroup = [...tempGroup, ...newCrateSkins];
                    const tempSum = combinedGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
                    
                    if (tempSum <= targetConvertedSum) {
                        const diff = targetConvertedSum - tempSum;
                        if (diff < bestDiff) {
                            bestDiff = diff;
                            bestGroup = combinedGroup;
                            bestSum = tempSum;
                        }
                    }
                }
            }
        }
    }
    
    return { group: bestGroup, sum: bestSum };
};

// 判断替换后的数量是否更接近目标
UserInventoryEnhanced.isQuantityBetter = function(newQuantities, oldQuantities) {
    let newDeviation = 0;
    let oldDeviation = 0;
    
    for (const crate in this.crateQuantities) {
        const targetQuantity = this.crateQuantities[crate];
        const newQuantity = newQuantities[crate] || 0;
        const oldQuantity = oldQuantities[crate] || 0;
        
        newDeviation += Math.abs(newQuantity - targetQuantity);
        oldDeviation += Math.abs(oldQuantity - targetQuantity);
    }
    
    return newDeviation < oldDeviation;
};

// 改进的带数量控制的贪心优化算法
UserInventoryEnhanced.improvedGreedyOptimizeWithQuantity = function(selectedSkins, targetConvertedSum) {
    if (selectedSkins.length < 10) return null;
    
    let bestResult = null;
    let bestSum = -1;
    
    // 尝试多种不同的初始组合
    for (let attempt = 0; attempt < 3; attempt++) {
        let currentGroup;
        
        if (attempt === 0) {
            // 策略1：选择转换后磨损值最高的10个皮肤
            selectedSkins.sort((a, b) => b.convertedWear - a.convertedWear);
            currentGroup = selectedSkins.slice(0, 10);
        } else if (attempt === 1) {
            // 策略2：选择原始位置最好的10个皮肤
            selectedSkins.sort((a, b) => b.originalPosition - a.originalPosition);
            currentGroup = selectedSkins.slice(0, 10);
        } else {
            // 策略3：随机选择10个皮肤作为初始组合
            const shuffled = [...selectedSkins].sort(() => Math.random() - 0.5);
            currentGroup = shuffled.slice(0, 10);
        }
        
        let currentSum = currentGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
        
        // 如果当前组合已经满足要求，直接返回
        if (currentSum <= targetConvertedSum && currentSum > bestSum) {
            bestResult = { group: currentGroup, sum: currentSum };
            bestSum = currentSum;
        }
        
        // 使用改进的贪心替换策略
        const optimized = this.improvedGreedySwap(currentGroup, selectedSkins, targetConvertedSum);
        
        if (optimized && optimized.sum <= targetConvertedSum && optimized.sum > bestSum) {
            bestResult = optimized;
            bestSum = optimized.sum;
        }
    }
    
    return bestResult;
};

// 改进的贪心替换策略
UserInventoryEnhanced.improvedGreedySwap = function(currentGroup, allSkins, targetConvertedSum) {
    let bestGroup = [...currentGroup];
    let bestSum = bestGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
    
    // 如果当前组合已经满足要求，直接返回
    if (bestSum <= targetConvertedSum) {
        return { group: bestGroup, sum: bestSum };
    }
    
    let improved = true;
    let iterations = 0;
    
    // 迭代优化直到无法改进或达到最大迭代次数
    while (improved && iterations < 100) {
        improved = false;
        iterations++;
        
        // 尝试替换每个位置的皮肤
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < allSkins.length; j++) {
                // 跳过已经在组合中的皮肤
                if (bestGroup.includes(allSkins[j])) continue;
                
                const tempGroup = [...bestGroup];
                tempGroup[i] = allSkins[j];
                
                const tempSum = tempGroup.reduce((sum, skin) => sum + skin.convertedWear, 0);
                
                // 如果新组合更接近目标值且不超过目标值
                if (tempSum <= targetConvertedSum && tempSum > bestSum) {
                    bestGroup = tempGroup;
                    bestSum = tempSum;
                    improved = true;
                }
            }
        }
    }
    
    return bestSum <= targetConvertedSum ? { group: bestGroup, sum: bestSum } : null;
};

// 原始汰换算法（保持原有逻辑）
UserInventoryEnhanced.executeTradeupOriginal = function(candidateSkins, targetConvertedSum) {
    let bestResult = null;
    let bestSum = -1;
    
    // 遍历所有可能的10个皮肤组合
    for (let i = 0; i <= candidateSkins.length - 10; i++) {
        const initialGroup = candidateSkins.slice(i, i + 10);
        const optimized = this.greedyOptimize(initialGroup, candidateSkins, targetConvertedSum);
        
        if (optimized.sum > bestSum && optimized.sum <= targetConvertedSum) {
            bestSum = optimized.sum;
            bestResult = optimized;
        }
    }
    
    return bestResult;
};
