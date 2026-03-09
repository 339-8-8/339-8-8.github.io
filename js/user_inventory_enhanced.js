const UserInventoryEnhanced = {
    // 皮肤级别顺序（从低到高）
    gradeOrder: ['消费级', '工业级', '军规级', '受限级', '保密级', '隐秘级'],
    
    // 存储处理后的数据（全局可访问）
    processedData: null,
    
    // 存储当前最佳汰换结果
    currentTradeupResult: null,
    
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
        
        // 存储原始皮肤数据
        for (let i = 0; i < processedSkins.length; i++) {
            const skin = processedSkins[i];
            window.originalSkinsData.skins.push({
                originalName: skin.originalName,
                processedName: skin.processedName,
                wear: skin.wear
            });
        }
        
        for (const skin of processedSkins) {
            const matchResult = this.findMatchingSkin(skin.processedName, casesData);
            
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
        const importResults = document.getElementById('importResults');
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
                
                // 显示汇总信息（紧凑版）
                this.displaySummaryCompact(results);
                
                // 显示皮肤库存（完整版）
                this.displayResults(results.matched, importResults, 'matched');
                
                // 生成并保存文件
                const fileContent = this.generateUserInventoryFile(results);
                this.saveToFile(fileContent);
                
                // 显示处理结果区域
                const pasteResults = document.getElementById('pasteResults');
                if (pasteResults) {
                    pasteResults.style.display = 'block';
                }
                
                // 显示一键汰换区域
                const tradeupSection = document.getElementById('tradeupSection');
                if (tradeupSection) {
                    tradeupSection.style.display = 'block';
                }
                
                
            } catch (error) {
                console.error('处理皮肤数据时出错:', error);
                statusText.textContent = '处理失败';
                statusCount.textContent = '错误';
                
                // 隐藏进度条，显示按钮
                processStatus.style.display = 'none';
                processBtn.style.display = 'block';
                
                alert('处理皮肤数据时出错，请检查控制台获取详细信息');
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
        
        // 初始显示所有结果
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
            html += `
                <div class="compact-skin-item">
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
        resultDiv.className = 'tradeup-result';
        resultDiv.innerHTML = '';
        
        const targetSkinName = document.getElementById('targetSkinName').value.trim();
        const targetWearValue = parseFloat(document.getElementById('targetWearValue').value.trim());
        
        if (!targetSkinName) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 请输入目标产物名字';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        if (isNaN(targetWearValue)) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 请输入有效的目标产物磨损值';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        const matchedSkins = this.getMatchedSkins();
        if (!matchedSkins || matchedSkins.length === 0) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 请先处理皮肤数据';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        const targetSkin = this.findTargetSkin(targetSkinName);
        if (!targetSkin) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 未找到目标产物: ' + targetSkinName;
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        const lowerGrade = this.getLowerGrade(targetSkin.grade);
        if (!lowerGrade) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 该目标产物没有下级皮肤';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        if (targetWearValue < targetSkin.minWear || targetWearValue > targetSkin.maxWear) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = `❌ 目标产物磨损值超出范围 (${targetSkin.minWear} - ${targetSkin.maxWear})`;
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        const targetConvertedSum = this.calculateConvertedWear(targetWearValue, targetSkin.minWear, targetSkin.maxWear) * 10;
        
        const candidateSkins = matchedSkins.filter(skin => {
            return skin.grade === lowerGrade && skin.crate === targetSkin.crate;
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
                const originalIndex = window.originalSkinsData.skins.findIndex(s => 
                    s.originalName === skin.originalName && s.wear === skin.wear
                );
                skin.originalPosition = originalIndex !== -1 ? originalIndex + 1 : 0;
            } else {
                skin.originalPosition = 0;
            }
        });
        
        // 按照原始数据位置顺序排序（位置越大，序号越小）
        candidateSkins.sort((a, b) => b.originalPosition - a.originalPosition);
        
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
        
        if (!bestResult) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = '❌ 无法找到符合条件的皮肤组合';
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        const resultingWear = this.calculateUpperWear(bestResult.sum, targetSkin.minWear, targetSkin.maxWear);
        
        if (resultingWear > targetWearValue) {
            resultDiv.className = 'tradeup-result error';
            resultDiv.innerHTML = `❌ 汰换结果超出目标磨损值 (目标: ${targetWearValue.toFixed(6)}, 结果: ${resultingWear.toFixed(6)})`;
            setTimeout(() => {
                resultDiv.classList.add('show');
            }, 10);
            return;
        }
        
        // 在显示结果前，按照原始位置从大到小排序
        bestResult.group.sort((a, b) => b.originalPosition - a.originalPosition);
        
        let skinListHtml = '<div class="tradeup-skin-list">';
        bestResult.group.forEach((skin, index) => {
            skinListHtml += `
                <div class="tradeup-skin-item">
                    <div class="tradeup-skin-main">
                        <div class="tradeup-skin-name">
                            <span class="tradeup-order">#${index + 1}</span>
                            ${skin.skin}
                        </div>
                        <div class="tradeup-skin-details">
                            <div class="tradeup-skin-crate">${skin.crate}</div>
                            <div class="tradeup-skin-grade">${skin.grade}</div>
                            <div class="tradeup-skin-order-info">原始位置：${skin.originalPosition}</div>
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
        setTimeout(() => {
            resultDiv.classList.add('show');
        }, 10);
        
        // 保存当前结果并显示确认按钮
        this.currentTradeupResult = {
            skins: bestResult.group,
            targetSkin: targetSkin,
            targetWear: targetWearValue,
            resultingWear: resultingWear
        };
        
        const confirmBtn = document.getElementById('tradeupConfirmBtn');
        if (confirmBtn) {
            confirmBtn.style.display = 'block';
        }
        
        const popupBtn = document.getElementById('tradeupPopupBtn');
        if (popupBtn) {
            popupBtn.style.display = 'block';
        }
    },
    
    // 显示弹出窗口
    showTradeupPopup: function() {
        const popup = document.getElementById('tradeupPopup');
        const skinsContainer = document.getElementById('tradeupPopupSkins');
        const popupContent = document.querySelector('.tradeup-popup-content');
        const popupHeader = document.querySelector('.tradeup-popup-header');
        const popupBody = document.querySelector('.tradeup-popup-body');
        const popupLeft = document.querySelector('.tradeup-popup-left');
        
        // 根据浏览器缩放比例调整尺寸，确保显示为 1920x1080 物理像素
        const scale = window.devicePixelRatio || 1;
        const adjustedWidth = 1920 / scale;
        const adjustedHeight = 1080 / scale;
        const adjustedHeaderHeight = 246 / scale;
        const adjustedBodyHeight = 834 / scale;
        const adjustedLeftWidth = 795 / scale;
        // 调整左侧高度以显示滚动效果
        const adjustedLeftHeight = 740 / scale;
        const adjustedPaddingLeft = 57 / scale;
        const adjustedSkinWidth = 165 / scale;
        const adjustedSkinHeight = 193 / scale;
        const adjustedSkinMarginTop = 7 / scale;
        const adjustedSkinMarginRight = 28 / scale;
        const adjustedSkinPadding = 12 / scale;
        // 皮肤容器宽度：4个皮肤 + 3个右边距 + 更多余量
        const adjustedSkinsContainerWidth = (4 * adjustedSkinWidth + 3 * adjustedSkinMarginRight + 50);
        
        console.log('浏览器缩放比例:', scale, '窗口 CSS 尺寸:', adjustedWidth + '×' + adjustedHeight);
        
        if (popupContent) {
            popupContent.style.width = adjustedWidth + 'px';
            popupContent.style.height = adjustedHeight + 'px';
        }
        
        if (popupHeader) {
            popupHeader.style.height = adjustedHeaderHeight + 'px';
            popupHeader.style.width = adjustedWidth + 'px';
        }
        
        if (popupBody) {
            popupBody.style.height = adjustedBodyHeight + 'px';
            popupBody.style.width = adjustedWidth + 'px';
            popupBody.style.paddingLeft = adjustedPaddingLeft + 'px';
        }
        
        if (popupLeft) {
            popupLeft.style.width = adjustedLeftWidth + 'px';
            popupLeft.style.height = adjustedLeftHeight + 'px';
        }
        
        if (skinsContainer) {
            skinsContainer.style.padding = `${adjustedSkinMarginTop}px ${adjustedSkinMarginRight}px 0 0`;
            skinsContainer.style.width = adjustedSkinsContainerWidth + 'px';
        }
        
        let skinsHtml = '';
        
        if (this.currentTradeupResult) {
            // 显示汰换结果
            this.currentTradeupResult.skins.forEach((skin, index) => {
                skinsHtml += this.createSkinCard(skin);
            });
        } else {
            // 显示测试数据 - 76 个皮肤
            const baseSkins = [
                { skin: 'AK-47 | 火神', crate: '命悬一线武器箱', grade: '保密', wear: '0.01234' },
                { skin: 'AWP | 巨龙传说', crate: '猎杀者武器箱', grade: '隐秘', wear: '0.05678' },
                { skin: 'M4A4 | 如何制作', crate: '布拉沃武器箱', grade: '保密', wear: '0.09876' },
                { skin: 'Karambit | 渐变之色', crate: '武器箱', grade: '★隐秘', wear: '0.04321' },
                { skin: 'USP-S | Printstream', crate: '裂空武器箱', grade: '保密', wear: '0.08765' },
                { skin: 'Glock-18 | 水灵', crate: '突围大行动', grade: '保密', wear: '0.02468' },
                { skin: 'M9 Bayonet | 多普勒', crate: '武器箱', grade: '★隐秘', wear: '0.06802' },
                { skin: 'Desert Eagle | 印花集', crate: '梦魇武器箱', grade: '受限', wear: '0.01357' },
                { skin: 'P90 | 翡翠之龙', crate: '2021 年尘埃 2 收藏包', grade: '保密', wear: '0.05791' },
                { skin: '蝴蝶刀 | 渐变之色', crate: '武器箱', grade: '★隐秘', wear: '0.09135' },
                { skin: 'AK-47 | 二西莫夫', crate: '先锋大行动', grade: '保密', wear: '0.15234' },
                { skin: 'AWP | 二西莫夫', crate: '突破大行动', grade: '保密', wear: '0.18765' },
                { skin: 'M4A1-S | 玩家二号', crate: '2018 年伦敦 Major', grade: '保密', wear: '0.07123' },
                { skin: '蝴蝶刀 | 多普勒', crate: '武器箱', grade: '★隐秘', wear: '0.03456' },
                { skin: 'AK-47 | 红线', crate: '凤凰大行动', grade: '保密', wear: '0.11234' },
                { skin: 'AWP | 闪电猎龙', crate: '狂牙大行动', grade: '保密', wear: '0.14567' },
                { skin: 'M4A4 | 地狱烈焰', crate: '炼狱小镇武器箱', grade: '受限', wear: '0.08234' },
                { skin: '蝴蝶刀 | 表面淬火', crate: '武器箱', grade: '★隐秘', wear: '0.06789' },
                { skin: 'AK-47 | 燃料喷射器', crate: '命悬一线武器箱', grade: '保密', wear: '0.13456' },
                { skin: 'AWP | 暴怒之怒', crate: '2018 年伦敦 Major', grade: '保密', wear: '0.09876' },
            ];
            
            // 扩展到 76 个皮肤
            const testSkins = [];
            for (let i = 0; i < 4; i++) {
                baseSkins.forEach(skin => {
                    testSkins.push({
                        skin: skin.skin,
                        crate: skin.crate,
                        grade: skin.grade,
                        wear: (Math.random() * 0.2).toFixed(5)
                    });
                });
            }
            // 确保正好 76 个
            testSkins.length = 76;
            
            testSkins.forEach((skin, index) => {
                skinsHtml += this.createSkinCard(skin);
            });
        }
        
        skinsContainer.innerHTML = skinsHtml;
        
        // 调整皮肤卡片尺寸
        setTimeout(() => {
            const skinCards = document.querySelectorAll('.tradeup-popup-skin-card');
            skinCards.forEach(card => {
                card.style.width = adjustedSkinWidth + 'px';
                card.style.height = adjustedSkinHeight + 'px';
                card.style.marginTop = adjustedSkinMarginTop + 'px';
                card.style.marginRight = adjustedSkinMarginRight + 'px';
                card.style.padding = adjustedSkinPadding + 'px';
            });
        }, 10);
        
        popup.classList.add('show');
    },
    
    // 创建皮肤卡片 HTML
    createSkinCard: function(skin) {
        return `
            <div class="tradeup-popup-skin-card">
                <div class="tradeup-popup-skin-main">
                    <div class="tradeup-popup-skin-name">${skin.skin}</div>
                    <div class="tradeup-popup-skin-details">
                        <div class="tradeup-popup-skin-crate">${skin.crate}</div>
                        <div class="tradeup-popup-skin-grade">${skin.grade}</div>
                    </div>
                </div>
                <div class="tradeup-popup-skin-wear">磨损：${skin.wear}</div>
            </div>
        `;
    },
    
    // 隐藏弹出窗口
    hideTradeupPopup: function() {
        const popup = document.getElementById('tradeupPopup');
        popup.classList.remove('show');
    },
    
    // 隐藏弹出窗口
    hideTradeupPopup: function() {
        const popup = document.getElementById('tradeupPopup');
        popup.classList.remove('show');
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
            
            // 更新皮肤库存显示
            const importResults = document.getElementById('importResults');
            this.displayResults(this.processedData.matched, importResults, 'matched');
            
            // 更新汇总信息显示
            this.displaySummaryCompact(this.processedData);
        }
        
        // 清空结果（添加动画效果）
        const resultDiv = document.getElementById('tradeupResult');
        resultDiv.classList.remove('show');
        
        setTimeout(() => {
            resultDiv.className = 'tradeup-result';
            resultDiv.innerHTML = '';
            
            // 隐藏确认按钮
            const confirmBtn = document.getElementById('tradeupConfirmBtn');
            if (confirmBtn) {
                confirmBtn.style.display = 'none';
            }
            
            // 隐藏弹出窗口按钮
            const popupBtn = document.getElementById('tradeupPopupBtn');
            if (popupBtn) {
                popupBtn.style.display = 'none';
            }
            
            // 清空当前结果
            this.currentTradeupResult = null;
        }, 300);
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
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
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
    
    const tradeupFetchBtn = document.getElementById('tradeupFetchBtn');
    if (tradeupFetchBtn) {
        tradeupFetchBtn.addEventListener('click', function() {
            UserInventoryEnhanced.fetchFromLeft();
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
});