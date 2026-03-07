const UserInventoryEnhanced = {
    // 存储处理后的数据（全局可访问）
    processedData: null,
    
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
        
        for (const skin of processedSkins) {
            const matchResult = this.findMatchingSkin(skin.processedName, casesData);
            
            if (matchResult.matched) {
                results.matched.push({
                    originalName: skin.originalName,
                    processedName: skin.processedName,
                    wear: skin.wear,
                    crate: matchResult.crate,
                    grade: matchResult.grade,
                    skin: matchResult.skin,
                    matchType: matchResult.matchType
                });
            } else {
                results.unmatched.push({
                    originalName: skin.originalName,
                    processedName: skin.processedName,
                    wear: skin.wear,
                    matchType: matchResult.matchType
                });
            }
        }
        
        // 按磨损值从低到高排序
        results.matched.sort((a, b) => a.wear - b.wear);
        results.unmatched.sort((a, b) => a.wear - b.wear);
        
        // 更新汇总信息
        results.summary.totalMatched = results.matched.length;
        results.summary.totalUnmatched = results.unmatched.length;
        results.summary.matchRate = results.summary.totalProcessed > 0 ? 
            (results.summary.totalMatched / results.summary.totalProcessed * 100).toFixed(2) : 0;
        
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
        const exportBtn = document.getElementById('exportBtn');
        const processStatus = document.getElementById('processStatus');
        const buttonRow = document.querySelector('.button-row');
        
        const pastedText = pasteTextarea.value.trim();
        
        if (!pastedText) {
            alert('请先粘贴皮肤数据');
            return;
        }
        
        // 隐藏按钮，显示进度条
        buttonRow.style.display = 'none';
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
                    buttonRow.style.display = 'flex';
                }, 500);
                
                // 显示匹配结果
                this.displayResults(results.matched, importResults, 'matched');
                
                // 显示未匹配结果（紧凑版）
                this.displayUnmatchedCompact(results.unmatched);
                
                // 生成并保存文件
                const fileContent = this.generateUserInventoryFile(results);
                this.saveToFile(fileContent);
                
                // 显示汇总信息
                this.showSummary(results);
                
                // 显示导出按钮
                if (exportBtn) {
                    exportBtn.style.display = 'block';
                }
                
                
            } catch (error) {
                console.error('处理皮肤数据时出错:', error);
                statusText.textContent = '处理失败';
                statusCount.textContent = '错误';
                
                // 隐藏进度条，显示按钮
                processStatus.style.display = 'none';
                buttonRow.style.display = 'flex';
                
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
        const unmatchedList = document.getElementById('unmatchedListCompact');
        
        if (!results || !results.length) {
            unmatchedList.innerHTML = '<div class="no-data-compact">暂无未匹配数据</div>';
            return;
        }
        
        // 去重
        const seenNames = new Set();
        const uniqueResults = results.filter(item => {
            if (seenNames.has(item.originalName)) {
                return false;
            }
            seenNames.add(item.originalName);
            return true;
        });
        
        let html = '';
        uniqueResults.forEach(item => {
            html += `
                <div class="unmatched-item-compact">
                    <span class="unmatched-name-compact">${item.originalName}</span>
                </div>
            `;
        });
        unmatchedList.innerHTML = html;
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

    // 显示汇总信息
    showSummary: function(results) {
        const summary = document.createElement('div');
        summary.className = 'import-summary';
        summary.innerHTML = `
            <strong>处理完成！</strong><br>
            共处理 ${results.summary.totalProcessed} 个皮肤<br>
            匹配成功: ${results.summary.totalMatched} 个 (${results.summary.matchRate}%)<br>
            未匹配: ${results.summary.totalUnmatched} 个<br>
            数据已保存到 user_temporary_inventory.js
        `;
        
        const importResults = document.getElementById('importResults');
        importResults.appendChild(summary);
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
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            UserInventoryEnhanced.exportData();
        });
    }
});