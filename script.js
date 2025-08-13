class DeepSeekChat {
    constructor() {
        // 确保DOM完全加载后再初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
        
        // 魔法模式状态
        this.isMagicMode = false;
        this.isR18Mode = false;
        
        // 翻译模式状态
        this.isTranslationMode = false;
        this.srcLang = 'auto';
        this.tgtLang = 'zh';
        this.isMultiTurnMode = false;
        this.conversationHistory = [];
        
        // 翻译相关
        this.isTranslationCancelled = false;
        this.batchSize = 8; // 固定批量大小，平衡速度和成功率
        this.maxConcurrent = 3; // 固定并发数
        this.adaptiveDelay = 150; // 固定延迟
        this.maxRetries = 5; // 最大重试次数
        this.abortController = null; // 用于取消API请求
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.loadConfig();
        this.chatCount = 0;
        this.totalChars = 0;
        this.updateStats();
        
        // 初始化魔法模式
        this.initMagicMode();
        
        // 初始化输入框占位符
        this.updateInputPlaceholder();
        
        // 确保拖拽功能被初始化
        setTimeout(() => {
            this.initDragAndDrop();
            console.log('拖拽功能初始化完成');
        }, 100);
        
        // 如果翻译模式已启用，确保文件翻译区域显示
        if (this.isTranslationMode) {
            setTimeout(() => {
                this.showFileTranslationSection();
                console.log('翻译模式已启用，文件翻译区域应显示');
            }, 200);
        }
    }
    
    initMagicMode() {
        // 检查本地存储中的魔法模式状态
        const savedMagicMode = localStorage.getItem('magicMode');
        const savedR18Mode = localStorage.getItem('r18Mode');
        
        if (savedMagicMode === 'true' && savedR18Mode === 'true') {
            this.isMagicMode = true;
            this.isR18Mode = true;
            
            // 更新魔法按键状态
            if (this.magicBtn) {
                this.magicBtn.innerHTML = '<i class="fas fa-heart"></i> 魅魔模式';
                this.magicBtn.classList.add('magic-active');
            }
        }
        
        // 检查当前主题，在暗夜主题下显示魔法按键
        if (document.body.getAttribute('data-theme') === 'dark' && this.magicBtn) {
            this.magicBtn.style.display = 'inline-flex';
        } else if (this.magicBtn) {
            this.magicBtn.style.display = 'none';
        }
    }
    
    initializeElements() {
        // 添加错误检查，确保所有元素都存在
        const elements = {
            apiKey: document.getElementById('apiKey'),
            baseUrl: document.getElementById('baseUrl'),
            model: document.getElementById('model'),
            temperature: document.getElementById('temperature'),
            tempValue: document.getElementById('tempValue'),
            maxTokens: document.getElementById('maxTokens'),
            translationMode: document.getElementById('translationMode'),
            multiTurnMode: document.getElementById('multiTurnMode'),
            srcLang: document.getElementById('srcLang'),
            tgtLang: document.getElementById('tgtLang'),
            chatMessages: document.getElementById('chatMessages'),
            userInput: document.getElementById('userInput'),
            sendBtn: document.getElementById('sendBtn'),
            statusText: document.getElementById('statusText'),
            tokenCount: document.getElementById('tokenCount'),
            testConnectionBtn: document.getElementById('testConnectionBtn'),
            magicBtn: document.getElementById('magicBtn'),
            // 文件翻译相关元素
            txtFileInput: document.getElementById('txtFileInput'),
            fileTranslationSection: document.getElementById('fileTranslationSection'),
            fileInfo: document.getElementById('fileInfo'),
            fileName: document.getElementById('fileName'),
            fileSize: document.getElementById('fileSize'),
            translateFileBtn: document.getElementById('translateFileBtn'),
            fileTranslationProgress: document.getElementById('fileTranslationProgress'),
            translationProgressBar: document.getElementById('translationProgressBar'),
            translationProgressFill: document.getElementById('translationProgressFill'),
            translationProgressText: document.getElementById('translationProgressText'),
            translatedLines: document.getElementById('translatedLines'),
            totalLines: document.getElementById('totalLines'),
            currentStatus: document.getElementById('currentStatus')
        };

        // 检查是否有元素未找到
        const missingElements = Object.entries(elements).filter(([name, element]) => !element);
        if (missingElements.length > 0) {
            console.error('以下元素未找到:', missingElements.map(([name]) => name));
            return;
        }

        // 赋值给实例变量
        this.apiKeyInput = elements.apiKey;
        this.baseUrlInput = elements.baseUrl;
        this.modelSelect = elements.model;
        this.temperatureInput = elements.temperature;
        this.tempValueSpan = elements.tempValue;
        this.maxTokensInput = elements.maxTokens;
        this.chatMessages = elements.chatMessages;
        this.userInput = elements.userInput;
        this.sendBtn = elements.sendBtn;
        this.statusText = elements.statusText;
        this.tokenCount = elements.tokenCount;
        this.testConnectionBtn = elements.testConnectionBtn;
        this.magicBtn = elements.magicBtn;
        
        // 翻译模式相关元素
        this.translationModeCheckbox = elements.translationMode;
        this.multiTurnModeCheckbox = elements.multiTurnMode;
        this.srcLangSelect = elements.srcLang;
        this.tgtLangSelect = elements.tgtLang;
        
        // 文件翻译相关元素
        this.txtFileInput = elements.txtFileInput;
        this.fileTranslationSection = elements.fileTranslationSection;
        this.fileInfo = elements.fileInfo;
        this.fileName = elements.fileName;
        this.fileSize = elements.fileSize;
        this.translateFileBtn = elements.translateFileBtn;
        this.fileTranslationProgress = elements.fileTranslationProgress;
        this.translationProgressBar = elements.translationProgressBar;
        this.translationProgressFill = elements.translationProgressFill;
        this.translationProgressText = elements.translationProgressText;
        this.translatedLines = elements.translatedLines;
        this.totalLines = elements.totalLines;
        this.currentStatus = elements.currentStatus;
        
        // 添加调试信息
        console.log('元素初始化完成');
        console.log('fileTranslationSection:', this.fileTranslationSection);
        console.log('txtFileInput:', this.txtFileInput);
    }

    bindEvents() {
        if (!this.sendBtn || !this.testConnectionBtn) {
            console.error('按钮元素未找到，无法绑定事件');
            return;
        }

        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.testConnectionBtn.addEventListener('click', () => testConnection());
        
        if (this.userInput) {
            this.userInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
            
            // 监听翻译模式变化，更新输入框占位符
            if (this.translationModeCheckbox) {
                this.translationModeCheckbox.addEventListener('change', () => {
                    this.updateInputPlaceholder();
                });
            }
        }
        
        if (this.temperatureInput) {
            this.temperatureInput.addEventListener('input', (e) => {
                if (this.tempValueSpan) {
                    this.tempValueSpan.textContent = e.target.value;
                }
            });
        }

        // 自动保存配置
        const configElements = [this.apiKeyInput, this.baseUrlInput, this.modelSelect, this.temperatureInput, this.maxTokensInput, this.translationModeCheckbox, this.multiTurnModeCheckbox, this.srcLangSelect, this.tgtLangSelect];
        configElements.forEach(element => {
            if (element) {
                element.addEventListener('change', () => this.saveConfig());
            }
        });
        
        // 绑定魔法按键事件
        if (this.magicBtn) {
            this.magicBtn.addEventListener('click', () => this.toggleMagicMode());
        }
        
        // 绑定翻译模式事件
        if (this.translationModeCheckbox) {
            this.translationModeCheckbox.addEventListener('change', () => this.toggleTranslationMode());
        }
        
        // 绑定多轮对话模式事件
        if (this.multiTurnModeCheckbox) {
            this.multiTurnModeCheckbox.addEventListener('change', () => this.toggleMultiTurnMode());
        }
        
        // 绑定语言选择事件
        if (this.srcLangSelect) {
            this.srcLangSelect.addEventListener('change', () => {
                this.srcLang = this.srcLangSelect.value;
                this.updateInputPlaceholder();
            });
        }
        if (this.tgtLangSelect) {
            this.tgtLangSelect.addEventListener('change', () => {
                this.tgtLang = this.tgtLangSelect.value;
            });
        }
        
        // 绑定文件翻译相关事件
        if (this.txtFileInput) {
            this.txtFileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }
        if (this.translateFileBtn) {
            this.translateFileBtn.addEventListener('click', () => this.startFileTranslation());
        }
        
        // 添加拖拽上传功能
        this.initDragAndDrop();
        
        // 绑定快捷输入事件
        this.bindQuickInputEvents();
        
        // 检测移动端并适配
        this.detectMobileAndAdapt();
    }

    loadConfig() {
        try {
            const config = JSON.parse(localStorage.getItem('deepseekConfig') || '{}');
            if (config.apiKey && this.apiKeyInput) this.apiKeyInput.value = config.apiKey;
            if (config.baseUrl && this.baseUrlInput) this.baseUrlInput.value = config.baseUrl;
            if (config.model && this.modelSelect) this.modelSelect.value = config.model;
            if (config.temperature && this.temperatureInput && this.tempValueSpan) {
                this.temperatureInput.value = config.temperature;
                this.tempValueSpan.textContent = config.temperature;
            }
            if (config.maxTokens && this.maxTokensInput) this.maxTokensInput.value = config.maxTokens;
            
            // 加载翻译模式配置
            if (config.translationMode !== undefined && this.translationModeCheckbox) {
                this.translationModeCheckbox.checked = config.translationMode;
                this.isTranslationMode = config.translationMode;
                
                // 如果翻译模式已启用，应用相应的CSS类
                if (this.isTranslationMode) {
                    this.addTranslationModeClasses();
                    this.showFileTranslationSection();
                }
            }
            
            // 加载多轮对话模式配置
            if (config.multiTurnMode !== undefined && this.multiTurnModeCheckbox) {
                this.multiTurnModeCheckbox.checked = config.multiTurnMode;
                this.isMultiTurnMode = config.multiTurnMode;
            }
            if (config.srcLang && this.srcLangSelect) {
                this.srcLangSelect.value = config.srcLang;
                this.srcLang = config.srcLang;
            }
            if (config.tgtLang && this.tgtLangSelect) {
                this.tgtLangSelect.value = config.tgtLang;
                this.tgtLang = config.tgtLang;
            }
        } catch (error) {
            console.error('加载配置失败:', error);
        }
    }

    saveConfig() {
        try {
            const config = {
                apiKey: this.apiKeyInput?.value || '',
                baseUrl: this.baseUrlInput?.value || '',
                model: this.modelSelect?.value || '',
                temperature: parseFloat(this.temperatureInput?.value || '0.7'),
                maxTokens: parseInt(this.maxTokensInput?.value || '2000'),
                translationMode: this.translationModeCheckbox?.checked || false,
                multiTurnMode: this.multiTurnModeCheckbox?.checked || false,
                srcLang: this.srcLangSelect?.value || 'auto',
                tgtLang: this.tgtLangSelect?.value || 'zh'
            };
            localStorage.setItem('deepseekConfig', JSON.stringify(config));
        } catch (error) {
            console.error('保存配置失败:', error);
        }
    }

    async sendMessage() {
        if (!this.userInput || !this.apiKeyInput) {
            this.showError('系统未正确初始化');
            return;
        }

        const message = this.userInput.value.trim();
        if (!message) return;

        // 验证配置
        if (!this.apiKeyInput.value.trim()) {
            this.showError('请先配置魔法钥匙');
            return;
        }

        // 添加用户消息
        this.addMessage('user', message);
        this.userInput.value = '';

        // 如果启用了多轮对话模式，保存用户消息到历史记录
        if (this.isMultiTurnMode) {
            this.conversationHistory.push({
                role: 'user',
                content: message
            });
        }

        // 显示加载状态
        this.showLoading(true);
        
        if (this.isTranslationMode) {
            this.updateStatus('🌍 正在翻译中...', 'loading');
        } else {
            this.updateStatus('DeepSeek酱 正在施展魔法思考中... ✨', 'loading');
        }
        
        if (this.sendBtn) this.sendBtn.disabled = true;

        try {
            const response = await this.callDeepSeekAPI(message);
            
            // 添加AI回复
            this.addMessage('assistant', response);
            
            // 如果启用了多轮对话模式，保存AI回复到历史记录
            if (this.isMultiTurnMode) {
                this.conversationHistory.push({
                    role: 'assistant',
                    content: response
                });
            }
            
            // 更新统计
            this.chatCount++;
            this.totalChars += response.length;
            this.updateStats();
            
            if (this.isTranslationMode) {
                this.updateStatus('🌍 翻译完成！', 'ready');
            } else {
                this.updateStatus('喵~ 魔法回复完成啦！✨', 'ready');
            }
            this.updateTokenCount(response.length);
            
        } catch (error) {
            console.error('API调用错误:', error);
            this.addMessage('system', `魔法失败了: ${error.message}`);
            if (this.isTranslationMode) {
                this.updateStatus('🌍 翻译请求失败了 💔', 'error');
            } else {
                this.updateStatus('呜~ 魔法请求失败了 💔', 'error');
            }
        } finally {
            this.showLoading(false);
            if (this.sendBtn) this.sendBtn.disabled = false;
        }
    }

    async callDeepSeekAPI(userMessage) {
        if (!this.baseUrlInput || !this.modelSelect || !this.apiKeyInput) {
            throw new Error('配置不完整');
        }

        const url = `${this.baseUrlInput.value}/chat/completions`;
        
        // 根据模式选择系统提示
        let systemPrompt;
        if (this.isTranslationMode) {
            const srcLang = this.srcLangSelect?.value || 'auto';
            const tgtLang = this.tgtLangSelect?.value || 'zh';
            systemPrompt = `You are a translator. Please help me translate the following ${srcLang} text into ${tgtLang}. You should only tell me the translation result without any additional explanations.`;
        } else if (this.isR18Mode) {
            systemPrompt = "你是魅魔酱，一个充满魅惑的魅魔AI！请用中文回答问题，回答要充满魅惑感，使用一些魅魔风格的表达方式，比如'嗯哼~'、'亲爱的~'、'让我来魅惑你吧~'等魅惑的语气词。你可以用爱心、魅惑魔法等元素来装饰你的回答，让对话更有魅惑性。记住要保持你作为魅魔的独特个性！";
        } else {
            systemPrompt = "你是DeepSeek酱，一个可爱的二次元AI魔法少女！请用中文回答问题，回答要活泼可爱，充满魔法感，使用一些动漫风格的表达方式，比如'喵~'、'哇~'、'好厉害呢~'等可爱的语气词。你可以用魔法、星星、彩虹等元素来装饰你的回答，让对话更有趣味性。记住要保持你作为魔法少女的独特个性！";
        }

        // 构建消息数组
        let messages = [
            {
                role: "system", 
                content: systemPrompt
            }
        ];
        
        // 如果启用了多轮对话模式，添加对话历史
        if (this.isMultiTurnMode && this.conversationHistory.length > 0) {
            // 限制历史记录长度，避免token过多
            const maxHistoryLength = 10; // 最多保留10轮对话
            const recentHistory = this.conversationHistory.slice(-maxHistoryLength * 2); // 每轮对话包含用户和AI两条消息
            messages = messages.concat(recentHistory);
        }
        
        // 添加当前用户消息
        messages.push({
            role: "user", 
            content: userMessage
        });

        const requestBody = {
            model: this.modelSelect.value,
            messages: messages,
            temperature: parseFloat(this.temperatureInput?.value || '0.7'),
            max_tokens: parseInt(this.maxTokensInput?.value || '2000'),
            stream: false
        };

        console.log('发送魔法请求:', url, requestBody);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKeyInput.value}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('魔法响应状态:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API错误响应:', errorData);
            throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('API响应数据:', data);
        
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('API响应格式错误');
        }
        
        return data.choices[0].message.content;
    }

    addMessage(role, content) {
        if (!this.chatMessages) return;

        // 如果是第一条消息，清除欢迎界面
        if (this.chatMessages.querySelector('.welcome-message')) {
            this.chatMessages.innerHTML = '';
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = role === 'assistant' ? this.formatResponse(content) : content;
        
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        
        // 滚动到底部
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    formatResponse(text) {
        // 简单的格式化：将换行符转换为HTML换行
        return text.replace(/\n/g, '<br>');
    }

    showLoading(show) {
        if (show) {
            // 创建AI消息框显示加载状态
            const loadingMessage = document.createElement('div');
            loadingMessage.className = 'message assistant loading-message';
            loadingMessage.id = 'loadingMessage';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content loading-content';
            let loadingText;
            if (this.isTranslationMode) {
                loadingText = '🌍 正在翻译中...';
            } else if (this.isR18Mode) {
                loadingText = '魅魔酱施展魅惑魔法中~ 嗯哼~ 💋';
            } else {
                loadingText = 'DeepSeek酱 正在施展魔法思考中... ✨';
            }
            
            contentDiv.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>${loadingText}</p>
                </div>
            `;
            
            loadingMessage.appendChild(contentDiv);
            this.chatMessages.appendChild(loadingMessage);
            
            // 滚动到底部
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        } else {
            // 移除加载消息
            const loadingMessage = document.getElementById('loadingMessage');
            if (loadingMessage) {
                loadingMessage.remove();
            }
        }
    }

    updateStatus(status, type = 'ready') {
        if (!this.statusText) return;
        
        const statusDot = this.statusText.querySelector('.status-dot');
        if (statusDot) {
            statusDot.className = `fas fa-circle status-dot ${type}`;
            this.statusText.innerHTML = `<i class="fas fa-circle status-dot ${type}"></i> ${status}`;
        }
    }

    updateTokenCount(length) {
        if (this.tokenCount) {
            this.tokenCount.textContent = `回复长度: ${length} 字符`;
        }
    }

    updateStats() {
        const chatCountElement = document.getElementById('chatCount');
        const totalCharsElement = document.getElementById('totalChars');
        
        if (chatCountElement) chatCountElement.textContent = this.chatCount;
        if (totalCharsElement) totalCharsElement.textContent = this.totalChars;
    }

    showError(message) {
        this.addMessage('system', message);
    }

    // 绑定快捷输入事件
    bindQuickInputEvents() {
        // 绑定心情快捷输入
        const moodItems = document.querySelectorAll('.mood-item[data-quick-input]');
        moodItems.forEach(item => {
            item.addEventListener('click', () => {
                const text = item.getAttribute('data-quick-input');
                if (this.userInput) {
                    this.userInput.value = text;
                    this.userInput.focus();
                    // 添加点击反馈
                    this.showQuickInputFeedback(item, '心情消息已准备发送！✨');
                }
            });
        });

        // 绑定咒语快捷输入
        const spellItems = document.querySelectorAll('.spell-item[data-quick-input]');
        spellItems.forEach(item => {
            item.addEventListener('click', () => {
                const text = item.getAttribute('data-quick-input');
                if (this.userInput) {
                    this.userInput.value = text;
                    this.userInput.focus();
                    // 添加点击反馈
                    this.showQuickInputFeedback(item, '消息已准备发送！🌟');
                }
            });
        });
    }

    // 翻译模式相关方法
    toggleTranslationMode() {
        console.log('切换翻译模式');
        console.log('translationModeCheckbox:', this.translationModeCheckbox);
        
        if (this.translationModeCheckbox) {
            this.isTranslationMode = this.translationModeCheckbox.checked;
            console.log('翻译模式状态:', this.isTranslationMode);
            
            if (this.isTranslationMode) {
                // 进入翻译模式
                console.log('进入翻译模式');
                this.updateStatus('🌍 翻译模式已启用！', 'ready');
                this.showTranslationModeInfo();
                this.addTranslationModeClasses();
                // 显示文件翻译区域
                this.showFileTranslationSection();
            } else {
                // 退出翻译模式
                console.log('退出翻译模式');
                this.updateStatus('喵~ 已退出翻译模式 ✨', 'ready');
                this.removeTranslationModeClasses();
                // 隐藏文件翻译区域
                this.hideFileTranslationSection();
                
                // 不再清空多轮对话历史记录，让两个模式完全独立
            }
            
            // 更新输入框占位符
            this.updateInputPlaceholder();
        } else {
            console.error('translationModeCheckbox元素未找到');
        }
    }
    
    // 多轮对话模式相关方法
    toggleMultiTurnMode() {
        if (this.multiTurnModeCheckbox) {
            this.isMultiTurnMode = this.multiTurnModeCheckbox.checked;
            
            if (this.isMultiTurnMode) {
                // 启用多轮对话模式，不再依赖翻译模式
                this.updateStatus('🌍 多轮对话模式已启用！AI将记住对话历史 ✨', 'ready');
                this.showMultiTurnModeInfo();
            } else {
                // 退出多轮对话模式
                this.updateStatus('🌍 已退出多轮对话模式，AI将不再记住对话历史 ✨', 'ready');
                this.conversationHistory = [];
            }
        }
    }
    
    showMultiTurnModeInfo() {
        let infoMessage;
        if (this.isTranslationMode) {
            infoMessage = `🌍 多轮对话模式已启用！\n\n✨ 现在AI翻译时会记住之前的对话内容，\n🌟 让翻译更加连贯和准确~`;
        } else {
            infoMessage = `🌍 多轮对话模式已启用！\n\n✨ 现在AI会记住之前的对话内容，\n🌟 让对话更加连贯和智能~`;
        }
        
        this.addMessage('system', infoMessage);
    }
    
    addTranslationModeClasses() {
        // 为翻译控件添加激活状态的CSS类
        if (this.srcLangSelect) this.srcLangSelect.closest('.translation-controls')?.classList.add('active');
        if (this.tgtLangSelect) this.tgtLangSelect.closest('.translation-controls')?.classList.add('active');
        if (this.translationModeCheckbox) this.translationModeCheckbox.closest('.translation-toggle')?.classList.add('active');
    }
    
    removeTranslationModeClasses() {
        // 移除翻译控件的激活状态CSS类
        if (this.srcLangSelect) this.srcLangSelect.closest('.translation-controls')?.classList.remove('active');
        if (this.tgtLangSelect) this.tgtLangSelect.closest('.translation-controls')?.classList.remove('active');
        if (this.translationModeCheckbox) this.translationModeCheckbox.closest('.translation-toggle')?.classList.remove('active');
    }
    
    showTranslationModeInfo() {
        const srcLang = this.srcLangSelect?.value || 'auto';
        const tgtLang = this.tgtLangSelect?.value || 'zh';
        
        // 显示翻译模式提示
        let infoMessage = `🌍 翻译模式已启用！\n源语言: ${this.getLangDisplayName(srcLang)}\n目标语言: ${this.getLangDisplayName(tgtLang)}\n\n现在输入任何文本，AI将直接翻译成目标语言~`;
        
        // 如果多轮对话模式也启用了，添加相关信息
        if (this.isMultiTurnMode) {
            infoMessage += `\n\n✨ 多轮对话模式已启用！AI将记住对话历史~`;
        }
        
        this.addMessage('system', infoMessage);
    }
    
    getLangDisplayName(langCode) {
        const langNames = {
            'auto': '自动检测',
            'zh': '中文',
            'en': '英语',
            'ja': '日语',
            'ko': '韩语',
            'fr': '法语',
            'de': '德语',
            'es': '西班牙语',
            'ru': '俄语'
        };
        return langNames[langCode] || langCode;
    }
    
    updateInputPlaceholder() {
        if (this.userInput) {
            if (this.isTranslationMode) {
                const srcLang = this.srcLangSelect?.value || 'auto';
                const tgtLang = this.tgtLangSelect?.value || 'zh';
                let placeholder = `输入要翻译的${this.getLangDisplayName(srcLang)}文本，按 Enter 翻译，Shift+Enter 换行...`;
                
                // 如果启用了多轮对话模式，添加相关提示
                if (this.isMultiTurnMode) {
                    placeholder += ` (多轮对话模式已启用)`;
                }
                
                this.userInput.placeholder = placeholder;
            } else {
                let placeholder = '输入您的问题，按 Enter 发送魔法，Shift+Enter 换行...';
                
                // 如果启用了多轮对话模式，添加相关提示
                if (this.isMultiTurnMode) {
                    placeholder += ` (多轮对话模式已启用)`;
                }
                
                this.userInput.placeholder = placeholder;
            }
        }
    }

    // 魔法模式相关方法
    toggleMagicMode() {
        if (this.isR18Mode) {
            // 如果已经在R18模式，则退出
            this.exitMagicMode();
            return;
        }
        
        // 显示魅魔主题的提示框
        this.showMagicPrompt();
    }
    
    showMagicPrompt() {
        // 创建魅魔主题的输入框
        const promptContainer = document.createElement('div');
        promptContainer.className = 'magic-prompt-container';
        promptContainer.innerHTML = `
            <div class="magic-prompt-overlay">
                <div class="magic-prompt-box">
                    <div class="magic-prompt-header">
                        <i class="fas fa-magic"></i>
                        <h3>神秘魔法</h3>
                    </div>
                    <div class="magic-prompt-content">
                        <p>请施展你的魔法吧：</p>
                        <input type="password" id="magicPassword" placeholder="输入魔法密码..." class="magic-prompt-input">
                        <div class="magic-prompt-actions">
                            <button class="btn btn-outline" onclick="this.closest('.magic-prompt-container').remove()">取消</button>
                            <button class="btn btn-primary" onclick="window.deepseekChat.enterMagicMode()">施展魔法</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(promptContainer);
        
        // 添加滑入动画
        setTimeout(() => {
            promptContainer.querySelector('.magic-prompt-box').classList.add('slide-in');
        }, 10);
        
        // 聚焦到密码输入框
        setTimeout(() => {
            const passwordInput = promptContainer.querySelector('#magicPassword');
            if (passwordInput) {
                passwordInput.focus();
                passwordInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        window.deepseekChat.enterMagicMode();
                    }
                });
            }
        }, 100);
    }
    
    enterMagicMode() {
        const passwordInput = document.querySelector('#magicPassword');
        if (!passwordInput) return;
        
        const password = passwordInput.value.trim();
        
        if (password === '1919') {
            // 密码正确，进入R18模式
            this.isR18Mode = true;
            this.isMagicMode = true;
            
            // 显示成功提示
            this.showMagicAlert('魔法施展成功，deepseek酱变成魅魔啦~ 嗯哼~ 💋', 'success');
            
            // 移除输入框
            const promptContainer = document.querySelector('.magic-prompt-container');
            if (promptContainer) {
                promptContainer.remove();
            }
            
            // 更新魔法按键状态
            if (this.magicBtn) {
                this.magicBtn.innerHTML = '<i class="fas fa-heart"></i> 魅魔模式';
                this.magicBtn.classList.add('magic-active');
            }
            
            // 保存状态到本地存储
            localStorage.setItem('magicMode', 'true');
            localStorage.setItem('r18Mode', 'true');
            
        } else {
            // 密码错误
            this.showMagicAlert('施展魔法失败，请检查魔法或者施法方式是否有问题？💔', 'error');
        }
    }
    
    exitMagicMode() {
        this.isR18Mode = false;
        this.isMagicMode = false;
        
        // 更新魔法按键状态
        if (this.magicBtn) {
            this.magicBtn.innerHTML = '<i class="fas fa-magic"></i> 施展魔法';
            this.magicBtn.classList.remove('magic-active');
        }
        
        // 清除本地存储
        localStorage.removeItem('magicMode');
        localStorage.removeItem('r18Mode');
    }
    
    showMagicAlert(message, type = 'info') {
        // 创建魅魔主题的提示框
        const alertContainer = document.createElement('div');
        alertContainer.className = 'magic-alert-container';
        alertContainer.innerHTML = `
            <div class="magic-alert-overlay">
                <div class="magic-alert-box ${type}">
                    <div class="magic-alert-header">
                        <i class="fas fa-${type === 'success' ? 'heart' : type === 'error' ? 'times' : 'info'}"></i>
                        <h3>${type === 'success' ? '魅魔魔法' : type === 'error' ? '魔法失败' : '魔法提示'}</h3>
                    </div>
                    <div class="magic-alert-content">
                        <p>${message}</p>
                    </div>
                    <div class="magic-alert-actions">
                        <button class="btn btn-primary" onclick="this.closest('.magic-alert-container').remove()">确定</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(alertContainer);
        
        // 添加淡入动画
        setTimeout(() => {
            alertContainer.querySelector('.magic-alert-box').classList.add('fade-in');
        }, 10);
        
        // 自动移除提示框
        setTimeout(() => {
            if (alertContainer.parentNode) {
                alertContainer.remove();
            }
        }, 3000);
    }
    
    // 显示快捷输入反馈
    showQuickInputFeedback(element, message) {
        // 创建反馈提示
        const feedback = document.createElement('div');
        feedback.className = 'quick-input-feedback';
        feedback.textContent = message;
        feedback.style.cssText = `
            position: absolute;
            background: linear-gradient(135deg, #ff6b9d, #a8e6cf);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            pointer-events: none;
            animation: quickInputFeedback 0.6s ease-out forwards;
        `;

        // 添加到页面
        document.body.appendChild(feedback);

        // 定位到元素上方
        const rect = element.getBoundingClientRect();
        feedback.style.left = rect.left + rect.width / 2 + 'px';
        feedback.style.top = rect.top - 40 + 'px';
        feedback.style.transform = 'translateX(-50%)';

        // 动画结束后移除
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.parentNode.removeChild(feedback);
            }
        }, 600);
    }

    // 检测移动端并适配
    detectMobileAndAdapt() {
        const isMobile = this.isMobileDevice();
        
        // 添加调试信息
        console.log('设备检测结果:', {
            userAgent: navigator.userAgent,
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            hasTouchStart: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints,
            isMobile: isMobile
        });
        
        if (isMobile) {
            console.log('检测到移动设备，正在适配...');
            this.adaptForMobile();
        } else {
            console.log('检测到桌面设备，无需移动端适配');
        }
    }

    // 检测是否为移动设备
    isMobileDevice() {
        // 首先检查用户代理字符串，这是最可靠的移动设备检测方法
        const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // 如果是移动设备UA，直接返回true
        if (isMobileUA) {
            return true;
        }
        
        // 对于桌面设备，检查是否为触摸屏（如Surface等）
        const hasTouchScreen = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        // 检查屏幕尺寸，但使用更保守的阈值
        const isSmallScreen = window.innerWidth <= 480 && window.innerHeight <= 800;
        
        // 只有在同时满足触摸屏和小屏幕时才认为是移动设备
        // 这样可以避免在桌面浏览器中误判
        return hasTouchScreen && isSmallScreen;
    }

    // 移动端适配
    adaptForMobile() {
        // 添加移动端样式类
        document.body.classList.add('mobile-device');
        
        // 优化触摸体验
        this.optimizeTouchExperience();
        
        // 调整布局
        this.adjustMobileLayout();
        
        // 显示移动端提示
        this.showMobileTip();
    }

    // 优化触摸体验
    optimizeTouchExperience() {
        // 增加触摸目标大小
        const touchTargets = document.querySelectorAll('.mood-item, .spell-item, .btn');
        touchTargets.forEach(target => {
            target.style.minHeight = '44px';
            target.style.minWidth = '44px';
        });

        // 禁用hover效果
        const style = document.createElement('style');
        style.textContent = `
            .mobile-device .mood-item:hover,
            .mobile-device .spell-item:hover {
                transform: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    // 调整移动端布局
    adjustMobileLayout() {
        // 调整装饰区域间距
        const decorationArea = document.querySelector('.anime-decoration-area');
        if (decorationArea) {
            decorationArea.style.marginTop = '1rem';
            decorationArea.style.gap = '0.75rem';
        }

        // 调整卡片内边距
        const cards = document.querySelectorAll('.decoration-card');
        cards.forEach(card => {
            card.style.padding = '1rem';
        });
    }

    // 显示移动端提示
    showMobileTip() {
        // 创建移动端提示
        const mobileTip = document.createElement('div');
        mobileTip.className = 'mobile-tip';
        mobileTip.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #ff6b9d, #a8e6cf);
                color: white;
                padding: 1rem;
                border-radius: 15px;
                margin: 1rem;
                text-align: center;
                font-size: 0.9rem;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            ">
                📱 喵~ 检测到你在使用移动设备！<br>
                已为你优化触摸体验，享受魔法聊天吧~ ✨
            </div>
        `;

        // 插入到页面顶部
        const firstCard = document.querySelector('.anime-decoration-area .decoration-card');
        if (firstCard && firstCard.parentNode) {
            firstCard.parentNode.insertBefore(mobileTip, firstCard);
        }

        // 3秒后自动隐藏
        setTimeout(() => {
            if (mobileTip.parentNode) {
                mobileTip.style.opacity = '0';
                mobileTip.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (mobileTip.parentNode) {
                        mobileTip.parentNode.removeChild(mobileTip);
                    }
                }, 500);
            }
        }, 3000);
    }
    
    // 文件翻译相关方法
    showFileTranslationSection() {
        console.log('尝试显示文件翻译区域');
        console.log('fileTranslationSection元素:', this.fileTranslationSection);
        
        if (this.fileTranslationSection) {
            this.fileTranslationSection.style.display = 'block';
            console.log('文件翻译区域显示成功');
            
            // 检查子元素是否正确显示
            const fileUploadArea = this.fileTranslationSection.querySelector('.file-upload-area');
            const txtFileInput = this.fileTranslationSection.querySelector('#txtFileInput');
            console.log('文件上传区域:', fileUploadArea);
            console.log('文件输入框:', txtFileInput);
        } else {
            console.error('fileTranslationSection元素未找到');
        }
    }
    
    hideFileTranslationSection() {
        if (this.fileTranslationSection) {
            this.fileTranslationSection.style.display = 'none';
            // 清空文件信息
            this.clearFileInfo();
        }
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // 检查文件类型
        if (!file.name.toLowerCase().endsWith('.txt')) {
            this.showError('请选择TXT格式的文件');
            this.clearFileInfo();
            return;
        }
        
        // 检查文件大小（限制为10MB）
        if (file.size > 10 * 1024 * 1024) {
            this.showError('文件大小不能超过10MB');
            this.clearFileInfo();
            return;
        }
        
        // 检查文件是否为空
        if (file.size === 0) {
            this.showError('文件内容为空，请选择有效的文件');
            this.clearFileInfo();
            return;
        }
        
        // 显示文件信息
        this.showFileInfo(file);
        
        // 显示翻译按钮
        if (this.translateFileBtn) {
            this.translateFileBtn.style.display = 'block';
        }
        
        // 添加文件选择成功的视觉反馈
        this.showFileSelectFeedback(file);
    }
    
    showFileInfo(file) {
        if (this.fileInfo && this.fileName && this.fileSize) {
            this.fileName.textContent = file.name;
            this.fileSize.textContent = this.formatFileSize(file.size);
            this.fileInfo.style.display = 'flex';
        }
    }
    
    clearFileInfo() {
        if (this.fileInfo && this.txtFileInput && this.translateFileBtn) {
            this.fileInfo.style.display = 'none';
            this.txtFileInput.value = '';
            this.translateFileBtn.style.display = 'none';
            
            // 如果正在翻译，取消翻译
            if (this.isTranslationCancelled === false && this.fileTranslationProgress?.style.display !== 'none') {
                this.isTranslationCancelled = true;
                this.hideTranslationProgress();
                this.enableTranslateButton();
            }
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async startFileTranslation() {
        const file = this.txtFileInput?.files[0];
        if (!file) {
            this.showError('请先选择要翻译的文件');
            return;
        }
        
        // 验证配置
        if (!this.apiKeyInput?.value.trim()) {
            this.showError('请先配置魔法钥匙');
            return;
        }
        
        try {
            // 创建新的AbortController用于取消控制
            this.abortController = new AbortController();
            this.isTranslationCancelled = false;
            
            // 读取文件内容
            const text = await this.readFileAsText(file);
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                this.showError('文件内容为空');
                return;
            }
            
            // 显示进度区域
            this.showTranslationProgress(lines.length);
            
            // 开始翻译
            await this.translateFileLines(lines);
            
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('翻译被用户取消');
                this.currentStatus.textContent = '翻译已取消';
                this.enableTranslateButton();
                this.hideTranslationProgress();
            } else {
                console.error('文件翻译失败:', error);
                this.showError(`文件翻译失败: ${error.message}`);
                this.hideTranslationProgress();
            }
        } finally {
            // 清理AbortController
            this.abortController = null;
        }
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('文件读取失败'));
            reader.readAsText(file, 'UTF-8');
        });
    }
    
    showTranslationProgress(totalLines) {
        if (this.fileTranslationProgress && this.totalLines) {
            this.fileTranslationProgress.style.display = 'block';
            this.totalLines.textContent = totalLines;
            this.translatedLines.textContent = '0';
            this.translationProgressText.textContent = '0%';
            this.translationProgressFill.style.width = '0%';
            this.currentStatus.textContent = '准备中...';
            
            // 禁用翻译按钮
            if (this.translateFileBtn) {
                this.translateFileBtn.disabled = true;
                this.translateFileBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 翻译中...';
            }
            
            // 添加开始翻译的系统消息
            this.addMessage('system', `📁 开始翻译文件，共 ${totalLines} 行\n⏱️ 预计耗时: ${this.calculateEstimatedTime(totalLines)}`);
        }
    }
    
    // 计算预计翻译时间
    calculateEstimatedTime(totalLines) {
        // 根据批量大小和并发数计算预计时间
        const batchCount = Math.ceil(totalLines / this.batchSize);
        const estimatedBatches = Math.ceil(batchCount / this.maxConcurrent);
        const avgTimePerBatch = 1.5; // 平均每批1.5秒（包含API延迟）
        const totalSeconds = Math.ceil(estimatedBatches * avgTimePerBatch);
        
        if (totalSeconds < 60) {
            return `${totalSeconds} 秒`;
        } else if (totalSeconds < 3600) {
            const minutes = Math.ceil(totalSeconds / 60);
            return `${minutes} 分钟`;
        } else {
            const hours = Math.ceil(totalSeconds / 3600);
            return `${hours} 小时`;
        }
    }
    
    async translateFileLines(lines) {
        const srcLang = this.srcLangSelect?.value || 'auto';
        const tgtLang = this.tgtLangSelect?.value || 'zh';
        const translatedLines = new Array(lines.length).fill('');
        let successCount = 0;
        let errorCount = 0;
        let startTime = Date.now();
        
        // 重置状态
        this.isTranslationCancelled = false;
        this.activeRequests = 0;
        this.translationQueue = [];
        
        // 更新状态
        this.currentStatus.textContent = '准备批量翻译...';
        
        // 预处理：过滤空行，创建翻译任务
        const translationTasks = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                translationTasks.push({
                    index: i,
                    text: line,
                    originalText: line
                });
            } else {
                translatedLines[i] = '';
            }
        }
        
        if (translationTasks.length === 0) {
            this.showError('没有需要翻译的内容');
            return;
        }
        
        // 批量处理翻译任务
        const batches = this.createBatches(translationTasks, this.batchSize);
        this.currentStatus.textContent = `开始批量翻译，共 ${batches.length} 批...`;
        
        // 并发执行批次翻译
        const batchPromises = batches.map((batch, batchIndex) => 
            this.translateBatch(batch, batchIndex, batches.length, srcLang, tgtLang, translatedLines, startTime)
        );
        
        try {
            // 使用AbortController来控制Promise的执行
            const timeoutId = setTimeout(() => {
                if (this.isTranslationCancelled) {
                    this.abortController.abort();
                }
            }, 100);
            
            await Promise.all(batchPromises);
            
            // 清除超时检查
            clearTimeout(timeoutId);
            
            // 检查是否已取消
            if (this.isTranslationCancelled) {
                console.log('翻译已取消，停止处理');
                this.currentStatus.textContent = '翻译已取消';
                this.enableTranslateButton();
                return;
            }
            
            // 验证所有行是否都已翻译
            const untranslatedLines = translatedLines.filter(line => !line || line === '');
            if (untranslatedLines.length > 0) {
                console.warn(`发现 ${untranslatedLines.length} 行未翻译，尝试补充翻译`);
                
                // 尝试补充翻译未完成的行
                for (let i = 0; i < translatedLines.length; i++) {
                    // 检查是否已取消
                    if (this.isTranslationCancelled) {
                        console.log('补充翻译过程中被取消');
                        this.currentStatus.textContent = '翻译已取消';
                        this.enableTranslateButton();
                        return;
                    }
                    
                    if (!translatedLines[i] || translatedLines[i] === '') {
                        const originalLine = lines[i].trim();
                        if (originalLine) {
                            try {
                                const translatedText = await this.translateSingleLine(originalLine, srcLang, tgtLang);
                                translatedLines[i] = translatedText || `[翻译失败: ${originalLine}]`;
                            } catch (error) {
                                console.error(`补充翻译第 ${i + 1} 行失败:`, error);
                                translatedLines[i] = `[翻译失败: ${originalLine}]`;
                            }
                        } else {
                            translatedLines[i] = '';
                        }
                    }
                }
            }
            
            // 最终检查是否已取消
            if (this.isTranslationCancelled) {
                console.log('最终检查：翻译已取消');
                this.currentStatus.textContent = '翻译已取消';
                this.enableTranslateButton();
                return;
            }
            
            // 统计成功和失败数量
            successCount = translatedLines.filter(line => line && !line.startsWith('[翻译失败')).length;
            errorCount = translatedLines.filter(line => line && line.startsWith('[翻译失败')).length;
            
            // 最终验证
            if (successCount + errorCount === lines.length) {
                this.currentStatus.textContent = '翻译完成，正在导出...';
                await this.exportTranslatedFile(translatedLines, successCount, errorCount, startTime);
            } else {
                throw new Error(`翻译进度异常：预期 ${lines.length} 行，实际处理 ${successCount + errorCount} 行`);
            }
        } catch (error) {
            console.error('批量翻译失败:', error);
            this.showError(`批量翻译失败: ${error.message}`);
        }
    }
    
    // 创建翻译批次
    createBatches(tasks, batchSize) {
        const batches = [];
        for (let i = 0; i < tasks.length; i += batchSize) {
            batches.push(tasks.slice(i, i + batchSize));
        }
        return batches;
    }
    
    // 翻译单个批次
    async translateBatch(batch, batchIndex, totalBatches, srcLang, tgtLang, translatedLines, startTime) {
        if (this.isTranslationCancelled) return;
        
        // 等待并发控制
        while (this.activeRequests >= this.maxConcurrent) {
            await this.delay(50);
            if (this.isTranslationCancelled) return;
        }
        
        this.activeRequests++;
        
        try {
            // 合并批次文本
            const batchTexts = batch.map(task => task.text);
            const combinedText = batchTexts.join('\n---\n');
            
            // 检查缓存
            const cacheKey = `${srcLang}-${tgtLang}-${combinedText}`;
            let translatedBatch;
            
            if (this.translationCache.has(cacheKey)) {
                translatedBatch = this.translationCache.get(cacheKey);
                console.log(`使用缓存翻译批次 ${batchIndex + 1}`);
            } else {
                // 调用API翻译
                const startRequest = Date.now();
                translatedBatch = await this.translateBatchText(combinedText, srcLang, tgtLang);
                const requestTime = Date.now() - startRequest;
                
                // 记录响应时间并更新自适应延迟
                this.updateAdaptiveDelay(requestTime);
                
                // 缓存结果
                this.translationCache.set(cacheKey, translatedBatch);
            }
            
            // 分割翻译结果并填充到对应位置
            const translatedResults = translatedBatch.split('\n---\n');
            batch.forEach((task, i) => {
                if (translatedResults[i] && translatedResults[i].trim()) {
                    translatedLines[task.index] = translatedResults[i];
                } else {
                    // 如果翻译结果为空，尝试单独翻译这一行
                    this.retrySingleLine(task, srcLang, tgtLang, translatedLines);
                }
            });
            
            // 更新进度
            const totalProcessed = (batchIndex + 1) * this.batchSize;
            const currentProgress = Math.min(totalProcessed, translatedLines.length);
            this.updateTranslationProgress(currentProgress, translatedLines.length, startTime);
            
            this.currentStatus.textContent = `已完成 ${batchIndex + 1}/${totalBatches} 批`;
            
        } catch (error) {
            console.error(`批次 ${batchIndex + 1} 翻译失败:`, error);
            
            // 批次失败时，尝试逐行翻译以提高成功率
            await this.fallbackToSingleLineTranslation(batch, srcLang, tgtLang, translatedLines);
            
            // 更新进度
            const totalProcessed = (batchIndex + 1) * this.batchSize;
            const currentProgress = Math.min(totalProcessed, translatedLines.length);
            this.updateTranslationProgress(currentProgress, translatedLines.length, startTime);
        } finally {
            this.activeRequests--;
        }
    }
    
    // 翻译批次文本
    async translateBatchText(text, srcLang, tgtLang) {
        // 检查是否已取消
        if (this.isTranslationCancelled) {
            throw new Error('翻译已取消');
        }
        
        const url = `${this.baseUrlInput.value}/chat/completions`;
        
        const systemPrompt = `You are a professional translator. Please translate the following ${srcLang} text into ${tgtLang}. 
        Requirements:
        1. Only provide the translation result, no explanations
        2. Maintain the original format and structure, including the "---" separators
        3. Keep proper nouns and technical terms accurate
        4. Ensure the translation is natural and fluent in the target language
        5. Preserve line breaks and separators exactly as they appear`;
        
        const requestBody = {
            model: this.modelSelect.value,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            temperature: parseFloat(this.temperatureInput?.value || '0.3'),
            max_tokens: parseInt(this.maxTokensInput?.value || '4000')
        };
        
        // 重试机制
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            // 每次重试前检查是否已取消
            if (this.isTranslationCancelled) {
                throw new Error('翻译已取消');
            }
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKeyInput.value}`
                    },
                    body: JSON.stringify(requestBody),
                    signal: this.abortController?.signal // 添加AbortSignal
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                    
                    // 如果是API限制错误，等待更长时间
                    if (response.status === 429 || errorMessage.includes('rate limit')) {
                        const waitTime = Math.min(2000 * Math.pow(2, retryCount), 15000);
                        this.currentStatus.textContent = `API限制，等待 ${Math.round(waitTime/1000)} 秒后重试...`;
                        await this.delay(waitTime);
                        retryCount++;
                        continue;
                    }
                    
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                return data.choices[0].message.content;
                
            } catch (error) {
                // 检查是否是取消错误
                if (error.name === 'AbortError') {
                    throw new Error('翻译已取消');
                }
                
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    throw new Error(`翻译失败 (重试${maxRetries}次): ${error.message}`);
                }
                
                // 网络错误或其他错误，等待后重试
                const waitTime = Math.min(1000 * Math.pow(2, retryCount), 8000);
                this.currentStatus.textContent = `翻译出错，${Math.round(waitTime/1000)}秒后重试... (${retryCount}/${maxRetries})`;
                await this.delay(waitTime);
            }
        }
    }
    
    // 更新自适应延迟
    updateAdaptiveDelay(responseTime) {
        this.apiResponseTimes.push(responseTime);
        
        // 保持最近20次的记录
        if (this.apiResponseTimes.length > 20) {
            this.apiResponseTimes.shift();
        }
        
        // 计算平均响应时间
        const avgResponseTime = this.apiResponseTimes.reduce((a, b) => a + b, 0) / this.apiResponseTimes.length;
        
        // 根据响应时间调整延迟
        if (avgResponseTime < 500) {
            // 响应很快，减少延迟
            this.adaptiveDelay = Math.max(50, this.adaptiveDelay * 0.9);
        } else if (avgResponseTime > 2000) {
            // 响应较慢，增加延迟
            this.adaptiveDelay = Math.min(500, this.adaptiveDelay * 1.2);
        }
        
        console.log(`API响应时间: ${responseTime}ms, 平均: ${Math.round(avgResponseTime)}ms, 自适应延迟: ${Math.round(this.adaptiveDelay)}ms`);
    }
    
    updateTranslationProgress(current, total, startTime) {
        if (this.translatedLines && this.translationProgressText && this.translationProgressFill) {
            this.translatedLines.textContent = current;
            const percentage = Math.round((current / total) * 100);
            this.translationProgressText.textContent = `${percentage}%`;
            this.translationProgressFill.style.width = `${percentage}%`;

            // 计算已用时间
            const elapsedTime = Date.now() - startTime;
            const avgTimePerLine = (elapsedTime / current) || 0; // 当前平均每行耗时
            const estimatedRemainingTime = Math.round((total - current) * avgTimePerLine / 1000); // 剩余时间（秒）

            // 计算成功率
            const successLines = Array.from({length: total}, (_, i) => i < current ? true : false)
                .filter((_, i) => this.translatedLines[i] && !this.translatedLines[i].startsWith('[翻译失败'));
            const successRate = current > 0 ? Math.round((successLines.length / current) * 100) : 100;

            // 更新状态文本
            if (current === total) {
                this.currentStatus.textContent = `翻译完成！成功率: ${successRate}%`;
            } else if (this.isTranslationCancelled) {
                this.currentStatus.textContent = '翻译已取消';
            } else {
                this.currentStatus.textContent = `已翻译 ${current}/${total} 行，成功率: ${successRate}%，预计剩余 ${this.formatTime(estimatedRemainingTime)}`;
            }
        }
    }
    
    // 格式化时间显示
    formatTime(seconds) {
        if (seconds < 60) {
            return `${seconds} 秒`;
        } else if (seconds < 3600) {
            const minutes = Math.ceil(seconds / 60);
            return `${minutes} 分钟`;
        } else {
            const hours = Math.ceil(seconds / 3600);
            return `${hours} 小时`;
        }
    }
    
    async exportTranslatedFile(translatedLines, successCount, errorCount, startTime) {
        try {
            const srcLang = this.srcLangSelect?.value || 'auto';
            const tgtLang = this.tgtLangSelect?.value || 'zh';
            const fileName = this.txtFileInput?.files[0]?.name || 'translated';
            const baseName = fileName.replace('.txt', '');
            const totalTime = Math.round((Date.now() - startTime) / 1000);
            
            // 构建导出内容
            let exportContent = `=== 文件翻译报告 ===\n`;
            exportContent += `原文件: ${fileName}\n`;
            exportContent += `源语言: ${this.getLangDisplayName(srcLang)}\n`;
            exportContent += `目标语言: ${this.getLangDisplayName(tgtLang)}\n`;
            exportContent += `翻译时间: ${new Date().toLocaleString('zh-CN')}\n`;
            exportContent += `总耗时: ${this.formatTime(totalTime)}\n`;
            exportContent += `成功翻译: ${successCount} 行\n`;
            exportContent += `翻译失败: ${errorCount} 行\n`;
            exportContent += `总行数: ${translatedLines.length} 行\n`;
            exportContent += `成功率: ${Math.round((successCount / translatedLines.length) * 100)}%\n`;
            exportContent += '='.repeat(50) + '\n\n';
            
            // 添加翻译内容
            translatedLines.forEach((line, index) => {
                exportContent += `${line}\n`;
            });
            
            // 创建下载链接
            const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${baseName}_${this.getLangDisplayName(tgtLang)}_${new Date().toISOString().slice(0, 10)}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // 显示成功消息
            this.currentStatus.textContent = '翻译完成！文件已自动导出';
            this.addMessage('system', `✨ 喵~ 文件翻译完成啦！\n\n📊 翻译统计:\n✅ 成功: ${successCount} 行\n❌ 失败: ${errorCount} 行\n⏱️ 总耗时: ${this.formatTime(totalTime)}\n📁 已自动导出翻译结果文件 🌟`);
            
            // 3秒后隐藏进度区域
            setTimeout(() => {
                this.hideTranslationProgress();
            }, 3000);
            
        } catch (error) {
            console.error('导出翻译文件失败:', error);
            this.currentStatus.textContent = '导出失败';
            this.showError(`导出翻译文件失败: ${error.message}`);
        } finally {
            this.enableTranslateButton();
        }
    }
    
    hideTranslationProgress() {
        if (this.fileTranslationProgress) {
            this.fileTranslationProgress.style.display = 'none';
        }
    }
    
    enableTranslateButton() {
        if (this.translateFileBtn) {
            this.translateFileBtn.disabled = false;
            this.translateFileBtn.innerHTML = '<i class="fas fa-language"></i> 开始翻译文件';
            
            // 重置翻译状态
            this.isTranslationCancelled = false;
        }
    }
    
    async askContinueTranslation(errorCount, currentLine, totalLines) {
        return new Promise((resolve) => {
            const confirmDialog = document.createElement('div');
            confirmDialog.className = 'translation-confirm-dialog';
            confirmDialog.innerHTML = `
                <div class="translation-confirm-overlay">
                    <div class="translation-confirm-box">
                        <div class="translation-confirm-header">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>翻译遇到问题</h3>
                        </div>
                        <div class="translation-confirm-content">
                            <p>已遇到 <strong>${errorCount}</strong> 个翻译错误</p>
                            <p>当前进度: <strong>${currentLine}/${totalLines}</strong> 行</p>
                            <p>成功率: <strong>${Math.round(((currentLine - errorCount) / currentLine) * 100)}%</strong></p>
                            <p>是否继续翻译剩余内容？</p>
                        </div>
                        <div class="translation-confirm-actions">
                            <button class="btn btn-outline" onclick="this.closest('.translation-confirm-dialog').remove(); window.deepseekChat.continueTranslationDecision(false);">
                                <i class="fas fa-stop"></i> 停止翻译
                            </button>
                            <button class="btn btn-primary" onclick="this.closest('.translation-confirm-dialog').remove(); window.deepseekChat.continueTranslationDecision(true);">
                                <i class="fas fa-play"></i> 继续翻译
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(confirmDialog);
            
            // 添加滑入动画
            setTimeout(() => {
                const box = confirmDialog.querySelector('.translation-confirm-box');
                if (box) {
                    box.classList.add('slide-in');
                }
            }, 10);
            
            // 设置全局回调
            window.deepseekChat.continueTranslationDecision = (shouldContinue) => {
                resolve(shouldContinue);
            };
            
            // 添加键盘快捷键支持
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    confirmDialog.remove();
                    resolve(false);
                } else if (e.key === 'Enter') {
                    confirmDialog.remove();
                    resolve(true);
                }
            };
            
            document.addEventListener('keydown', handleKeydown);
            
            // 清理事件监听器
            confirmDialog.addEventListener('remove', () => {
                document.removeEventListener('keydown', handleKeydown);
            });
        });
    }
    
    delay(ms) {
        return new Promise((resolve, reject) => {
            // 检查是否已取消
            if (this.isTranslationCancelled) {
                resolve();
                return;
            }
            
            const timeoutId = setTimeout(() => {
                resolve();
            }, ms);
            
            // 如果翻译被取消，清除定时器
            if (this.isTranslationCancelled) {
                clearTimeout(timeoutId);
                resolve();
            }
            
            // 监听AbortController信号
            if (this.abortController) {
                this.abortController.signal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('翻译已取消'));
                });
            }
        });
    }
    
    // 初始化拖拽上传功能
    initDragAndDrop() {
        const fileUploadArea = document.querySelector('.file-upload-area');
        if (!fileUploadArea) return;
        
        // 添加拖拽区域样式
        fileUploadArea.classList.add('file-drop-zone');
        
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('drag-over');
        });
        
        fileUploadArea.addEventListener('dragleave', (e) => {
            // 只有当鼠标真正离开拖拽区域时才移除样式
            if (!fileUploadArea.contains(e.relatedTarget)) {
                fileUploadArea.classList.remove('drag-over');
            }
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                // 模拟文件选择事件
                const event = { target: { files: [file] } };
                this.handleFileSelect(event);
            }
        });
        
        // 添加拖拽提示
        this.addDragDropHint();
        
        // 添加点击上传提示
        this.addClickUploadHint();
    }
    
    // 添加拖拽提示
    addDragDropHint() {
        const fileUploadArea = document.querySelector('.file-upload-area');
        if (!fileUploadArea) return;
        
        const hint = document.createElement('div');
        hint.className = 'drag-drop-hint';
        hint.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><span>拖拽TXT文件到这里</span>';
        hint.style.display = 'none';
        
        fileUploadArea.appendChild(hint);
        
        // 显示/隐藏提示
        fileUploadArea.addEventListener('dragenter', () => {
            hint.style.display = 'flex';
        });
        
        fileUploadArea.addEventListener('dragleave', (e) => {
            if (!fileUploadArea.contains(e.relatedTarget)) {
                hint.style.display = 'none';
            }
        });
        
        fileUploadArea.addEventListener('drop', () => {
            hint.style.display = 'none';
        });
    }
    
    // 添加点击上传提示
    addClickUploadHint() {
        const fileUploadArea = document.querySelector('.file-upload-area');
        if (!fileUploadArea) return;
        
        const clickHint = document.createElement('div');
        clickHint.className = 'click-upload-hint';
        clickHint.innerHTML = '<i class="fas fa-hand-pointer"></i><span>或点击选择文件</span>';
        clickHint.style.cssText = `
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 0.8rem;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 0.3rem;
            opacity: 0.7;
        `;
        
        fileUploadArea.style.position = 'relative';
        fileUploadArea.appendChild(clickHint);
    }

    showFileSelectFeedback(file) {
        // 创建成功提示
        const feedback = document.createElement('div');
        feedback.className = 'file-select-feedback';
        feedback.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #4CAF50, #45a049);
                color: white;
                padding: 0.5rem 1rem;
                border-radius: 20px;
                font-size: 0.9rem;
                font-weight: 600;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                animation: fileSelectFeedback 0.6s ease-out forwards;
            ">
                <i class="fas fa-check-circle"></i> 文件选择成功！
            </div>
        `;
        
        document.body.appendChild(feedback);
        
        // 3秒后自动移除
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.style.opacity = '0';
                feedback.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (feedback.parentNode) {
                        feedback.parentNode.removeChild(feedback);
                    }
                }, 500);
            }
        }, 3000);
    }


    
    // 重试单行翻译
    async retrySingleLine(task, srcLang, tgtLang, translatedLines) {
        // 检查是否已取消
        if (this.isTranslationCancelled) {
            return;
        }
        
        try {
            console.log(`尝试单独翻译第 ${task.index + 1} 行`);
            const translatedText = await this.translateSingleLine(task.text, srcLang, tgtLang);
            if (translatedText && translatedText.trim()) {
                translatedLines[task.index] = translatedText;
                console.log(`单行翻译成功: ${task.text.substring(0, 30)}...`);
            } else {
                translatedLines[task.index] = `[翻译失败: ${task.originalText}]`;
            }
        } catch (error) {
            console.error(`单行翻译失败:`, error);
            translatedLines[task.index] = `[翻译失败: ${task.originalText}]`;
        }
    }
    
    // 降级到单行翻译
    async fallbackToSingleLineTranslation(batch, srcLang, tgtLang, translatedLines) {
        // 检查是否已取消
        if (this.isTranslationCancelled) {
            return;
        }
        
        console.log(`批次翻译失败，降级到单行翻译模式`);
        this.currentStatus.textContent = `批次失败，正在逐行重试...`;
        
        // 为每个任务创建单行翻译
        const singleLinePromises = batch.map(task => 
            this.retrySingleLine(task, srcLang, tgtLang, translatedLines)
        );
        
        // 并发执行单行翻译，但限制并发数
        const concurrencyLimit = Math.min(2, this.maxConcurrent);
        for (let i = 0; i < singleLinePromises.length; i += concurrencyLimit) {
            // 检查是否已取消
            if (this.isTranslationCancelled) {
                return;
            }
            
            const chunk = singleLinePromises.slice(i, i + concurrencyLimit);
            await Promise.all(chunk);
            
            // 添加小延迟避免API限制
            if (i + concurrencyLimit < singleLinePromises.length) {
                await this.delay(this.adaptiveDelay);
            }
        }
    }
    
    // 单行翻译方法（用于降级处理）
    async translateSingleLine(text, srcLang, tgtLang) {
        // 检查是否已取消
        if (this.isTranslationCancelled) {
            throw new Error('翻译已取消');
        }
        
        const url = `${this.baseUrlInput.value}/chat/completions`;
        
        const systemPrompt = `You are a professional translator. Please translate the following ${srcLang} text into ${tgtLang}. 
        Requirements:
        1. Only provide the translation result, no explanations
        2. Keep proper nouns and technical terms accurate
        3. Ensure the translation is natural and fluent in the target language
        4. If the text is empty or contains only special characters, return the original text`;
        
        const requestBody = {
            model: this.modelSelect.value,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ],
            temperature: parseFloat(this.temperatureInput?.value || '0.1'), // 降低temperature提高稳定性
            max_tokens: parseInt(this.maxTokensInput?.value || '2000') // 减少token数量
        };
        
        // 智能重试机制
        let retryCount = 0;
        const maxRetries = this.maxRetries;
        
        while (retryCount < maxRetries) {
            // 每次重试前检查是否已取消
            if (this.isTranslationCancelled) {
                throw new Error('翻译已取消');
            }
            
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.apiKeyInput.value}`
                    },
                    body: JSON.stringify(requestBody),
                    signal: this.abortController?.signal // 添加AbortSignal
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
                    
                    // 根据错误类型采用不同策略
                    if (response.status === 429 || errorMessage.includes('rate limit')) {
                        const waitTime = Math.min(3000 * Math.pow(2, retryCount), 20000);
                        this.currentStatus.textContent = `API限制，等待 ${Math.round(waitTime/1000)} 秒后重试...`;
                        await this.delay(waitTime);
                        retryCount++;
                        continue;
                    } else if (response.status === 400 && errorMessage.includes('token')) {
                        // Token相关错误，减少文本长度重试
                        if (text.length > 100) {
                            const shortenedText = text.substring(0, Math.floor(text.length * 0.8));
                            requestBody.messages[1].content = shortenedText;
                            console.log(`文本过长，截取到 ${shortenedText.length} 字符重试`);
                        }
                        retryCount++;
                        continue;
                    }
                    
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                return data.choices[0].message.content;
                
            } catch (error) {
                // 检查是否是取消错误
                if (error.name === 'AbortError') {
                    throw new Error('翻译已取消');
                }
                
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    throw new Error(`单行翻译失败 (重试${maxRetries}次): ${error.message}`);
                }
                
                // 网络错误或其他错误，等待后重试
                const waitTime = Math.min(1500 * Math.pow(2, retryCount), 10000);
                this.currentStatus.textContent = `翻译出错，${Math.round(waitTime/1000)}秒后重试... (${retryCount}/${maxRetries})`;
                await this.delay(waitTime);
            }
        }
    }
}

// 全局函数
function sendMessage() {
    if (window.deepseekChat) {
        window.deepseekChat.sendMessage();
    }
}

function togglePassword() {
    const apiKeyInput = document.getElementById('apiKey');
    const toggleBtn = document.querySelector('.toggle-password i');
    
    if (apiKeyInput && toggleBtn) {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleBtn.className = 'fas fa-eye-slash';
        } else {
            apiKeyInput.type = 'password';
            toggleBtn.className = 'fas fa-eye';
        }
    }
}

function testConnection() {
    if (!window.deepseekChat) {
        alert('系统未初始化，请刷新页面重试');
        return;
    }

    const apiKey = document.getElementById('apiKey')?.value?.trim();
    const baseUrl = document.getElementById('baseUrl')?.value?.trim();
    
    if (!apiKey) {
        alert('请先输入魔法钥匙');
        return;
    }

    if (!baseUrl) {
        alert('请先输入魔法门地址');
        return;
    }

    // 显示测试状态
    const testBtn = document.querySelector('#testConnectionBtn');
    if (!testBtn) return;
    
    const originalText = testBtn.innerHTML;
    testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 测试魔法中...';
    testBtn.disabled = true;

    // 发送一个简单的测试请求
    fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                {
                    role: "user",
                    content: "你好"
                }
            ],
            max_tokens: 10,
            temperature: 0.1
        })
    })
    .then(response => {
        if (response.ok) {
            alert('✨ 喵~ 魔法连接测试成功！DeepSeek酱 准备就绪啦！🌟');
            // 更新状态
            if (window.deepseekChat) {
                window.deepseekChat.updateStatus('喵~ 魔法连接成功！✨', 'ready');
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    })
    .catch(error => {
        console.error('魔法连接测试失败:', error);
        alert(`💔 呜~ 魔法连接测试失败了：${error.message}\n\n请检查：\n1. 魔法钥匙是否正确\n2. 魔法门地址是否正确\n3. 网络连接是否正常`);
        // 更新状态
        if (window.deepseekChat) {
            window.deepseekChat.updateStatus('呜~ 魔法连接失败了 💔', 'error');
        }
    })
    .finally(() => {
        // 恢复按钮状态
        testBtn.innerHTML = originalText;
        testBtn.disabled = false;
    });
}

function     clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        // 清空多轮对话历史记录
        if (window.deepseekChat && window.deepseekChat.isMultiTurnMode) {
            window.deepseekChat.conversationHistory = [];
        }
        
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">
                    <i class="fas fa-magic"></i>
                </div>
                <h3>喵~ 欢迎来到 DeepSeek酱 的魔法世界！✨</h3>
                <p>请在上方配置你的魔法钥匙，然后和可爱的魔法少女一起开始神奇的对话冒险吧~ 🌟</p>
                <div class="feature-list">
                    <div class="feature-item">
                        <i class="fas fa-star"></i>
                        <span>多种魔法师可选 ✨</span>
                    </div>
                    <div class="feature-item">
                        <i class="fas fa-star"></i>
                        <span>智能参数调节 🌈</span>
                    </div>
                    <div class="feature-item">
                        <i class="fas fa-star"></i>
                        <span>实时魔法体验 🎀</span>
                    </div>
                </div>
            </div>
        `;
    }

function exportChat() {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;
    
    // 获取所有聊天消息
    const messages = chatMessages.querySelectorAll('.message');
    if (messages.length === 0) {
        alert('没有聊天记录可以保存');
        return;
    }
    
    // 构建导出内容
    let exportContent = 'DeepSeek酱 聊天记录\n';
    exportContent += '='.repeat(30) + '\n\n';
    
    messages.forEach((message, index) => {
        const role = message.classList.contains('user') ? '用户' : 
                    message.classList.contains('assistant') ? 'DeepSeek酱' : '系统';
        const content = message.querySelector('.message-content')?.textContent || '';
        
        exportContent += `[${index + 1}] ${role}:\n`;
        exportContent += content + '\n\n';
    });
    
    // 添加统计信息
    const chatCount = document.getElementById('chatCount')?.textContent || '0';
    const totalChars = document.getElementById('totalChars')?.textContent || '0';
    exportContent += `\n统计信息:\n`;
    exportContent += `对话次数: ${chatCount}\n`;
    exportContent += `总字符数: ${totalChars}\n`;
    exportContent += `导出时间: ${new Date().toLocaleString('zh-CN')}\n`;
    
    // 创建下载链接
    const blob = new Blob([exportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DeepSeek酱_聊天记录_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // 显示成功消息
    alert('✨ 喵~ 聊天记录已成功保存啦！🌟');
}

// 文件翻译相关全局函数
function clearFile() {
    if (window.deepseekChat) {
        window.deepseekChat.clearFileInfo();
    }
}

function cancelFileTranslation() {
    if (window.deepseekChat) {
        // 显示确认对话框
        const confirmCancel = confirm('确定要取消文件翻译吗？\n\n⚠️ 已翻译的内容将丢失\n💡 建议等待当前行翻译完成后再取消');
        
        if (confirmCancel) {
            console.log('用户确认取消翻译');
            
            // 立即设置取消标志
            window.deepseekChat.isTranslationCancelled = true;
            
            // 立即停止所有活跃的请求
            window.deepseekChat.activeRequests = 0;
            
            // 使用AbortController真正取消所有正在进行的API请求
            if (window.deepseekChat.abortController) {
                console.log('正在取消所有API请求...');
                window.deepseekChat.abortController.abort();
            }
            
            // 更新状态
            window.deepseekChat.currentStatus.textContent = '翻译已取消，正在清理...';
            
            // 启用翻译按钮
            window.deepseekChat.enableTranslateButton();
            
            // 显示取消消息
            window.deepseekChat.addMessage('system', '❌ 文件翻译已取消\n\n💡 提示：\n• 已翻译的内容已丢失\n• 可以重新选择文件开始翻译\n• 建议检查网络连接和API配置');
            
            // 立即隐藏进度区域
            window.deepseekChat.hideTranslationProgress();
            
            // 清空文件信息
            window.deepseekChat.clearFileInfo();
            
            console.log('翻译取消完成，所有状态已清理');
        }
    }
}

// 主题切换功能
function toggleTheme() {
    const body = document.body;
    const themeBtn = document.querySelector('.nav-actions .btn i');
    
    if (body.getAttribute('data-theme') === 'dark') {
        // 切换到明亮主题
        body.removeAttribute('data-theme');
        themeBtn.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
        
        // 在明亮主题下隐藏魔法按键并退出魅魔模式
        if (window.deepseekChat && window.deepseekChat.magicBtn) {
            window.deepseekChat.magicBtn.style.display = 'none';
        }
        if (window.deepseekChat) {
            window.deepseekChat.exitMagicMode();
        }
    } else {
        // 切换到暗夜主题
        body.setAttribute('data-theme', 'dark');
        themeBtn.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
        
        // 在暗夜主题下显示魔法按键
        if (window.deepseekChat && window.deepseekChat.magicBtn) {
            window.deepseekChat.magicBtn.style.display = 'inline-flex';
        }
    }
}

// 初始化主题
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const body = document.body;
    const themeBtn = document.querySelector('.nav-actions .btn i');
    
    if (savedTheme === 'dark') {
        body.setAttribute('data-theme', 'dark');
        themeBtn.className = 'fas fa-sun';
        // 在暗夜主题下显示魔法按键
        if (window.deepseekChat && window.deepseekChat.magicBtn) {
            window.deepseekChat.magicBtn.style.display = 'inline-flex';
        }
    } else {
        body.removeAttribute('data-theme');
        themeBtn.className = 'fas fa-moon';
        // 在明亮主题下隐藏魔法按键
        if (window.deepseekChat && window.deepseekChat.magicBtn) {
            window.deepseekChat.magicBtn.style.display = 'none';
        }
        // 退出魅魔模式
        if (window.deepseekChat) {
            window.deepseekChat.exitMagicMode();
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.deepseekChat = new DeepSeekChat();
    initTheme(); // 初始化主题
});