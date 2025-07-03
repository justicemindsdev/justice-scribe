// PDF Reader AI - Main Application
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';
import { v4 as uuidv4 } from 'https://cdn.jsdelivr.net/npm/uuid@8.3.2/dist/esm-browser/index.js';

// PDF.js setup
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

class PDFReaderAI {
    constructor() {
        this.supabase = null;
        this.pdfDocument = null;
        this.pageContents = [];
        this.pdfText = "";
        this.currentPage = 1;
        this.isConnected = false;
        this.currentSessionId = null; // New: To store the ID of the current chat session
        this.currentSessionToken = null; // New: To store the shared link token
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkDarkMode();
        this.updateConnectionStatus();
    }

    initializeElements() {
        // Main containers
        this.uploadContainer = document.getElementById('upload-container');
        this.pdfViewer = document.getElementById('pdf-viewer');
        this.pdfTitle = document.getElementById('pdf-title');
        
        // Upload elements
        this.fileUpload = document.getElementById('file-upload');
        this.browseButton = document.getElementById('browse-button');
        this.fileUploadContainer = document.querySelector('.file-upload-container');
        
        // PDF viewer elements
        this.thumbnailsContainer = document.getElementById('thumbnails-container');
        this.pdfRenderContainer = document.getElementById('pdf-render-container');
        this.responseHistory = document.getElementById('response-history');
        this.questionForm = document.getElementById('question-form');
        this.questionInput = document.getElementById('question');
        
        // Status elements
        this.connectionStatus = document.getElementById('connectionStatus');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        this.modelSelect = document.getElementById('modelSelect');
        this.savedSessionsContainer = document.getElementById('saved-sessions-container'); // New element
    }

    setupEventListeners() {
        // File upload events
        this.browseButton.addEventListener('click', () => this.fileUpload.click());
        this.fileUpload.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop events
        this.setupDragAndDrop();
        
        // Question form
        this.questionForm.addEventListener('submit', (e) => this.handleQuestionSubmit(e));
        
        // Template buttons
        document.querySelectorAll('.btn-template').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleTemplateClick(e));
        });
        
        // Auto-resize textarea
        this.questionInput.addEventListener('input', this.autoResizeTextarea.bind(this));

        // Share dialogue events
        this.shareChatButton = document.getElementById('share-chat-button');
        this.shareDialogueModal = document.getElementById('share-dialogue-modal');
        this.shareLinkInput = document.getElementById('share-link-input');
        this.copyShareLinkButton = document.getElementById('copy-share-link-button');
        this.closeShareDialogueButton = document.getElementById('close-share-dialogue-button');

        this.shareChatButton.addEventListener('click', () => this.openShareDialogue());
        this.closeShareDialogueButton.addEventListener('click', () => this.closeShareDialogue());
        this.copyShareLinkButton.addEventListener('click', () => this.copyShareLink());
    }

    checkDarkMode() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.documentElement.classList.add('dark');
        }
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
            if (event.matches) {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        });
    }

    async initializeApplication() {
        // Check if it's a shared session
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        if (sessionId) {
            await this.loadSharedSession(sessionId);
        } else {
            // Normal application flow
            this.connectToSupabase();
            // Load saved sessions for the user
            this.loadSavedSessions();
        }
    }

    async loadSharedSession(sessionId) {
        try {
            this.showLoading(true);
            this.pdfTitle.textContent = "Shared Session";
            
            // Fetch session and queries
            const { data: sessionData, error: sessionError } = await this.supabase
                .from('analysis_sessions')
                .select('*, analysis_queries(*)')
                .eq('shared_link_token', sessionId)
                .single();

            if (sessionError || !sessionData) {
                throw new Error('Shared session not found or accessible.');
            }

            // Hide upload and question input, show only chat history
            this.uploadContainer.classList.add('hidden');
            this.pdfViewer.classList.remove('hidden'); // Keep PDF viewer for context if PDF is available
            this.questionForm.classList.add('hidden');
            this.shareChatButton.classList.add('hidden'); // Hide share button in shared view

            // Load PDF if available
            if (sessionData.document_id) {
                const { data: docData, error: docError } = await this.supabase
                    .from('documents')
                    .select('*')
                    .eq('id', sessionData.document_id)
                    .single();
                
                if (docError || !docData) {
                    console.warn("Could not load document for shared session:", docError);
                    this.pdfTitle.textContent = "Shared Session (PDF not available)";
                } else {
                    // Simulate loading PDF from URL or storage path
                    // For now, just update title
                    this.pdfTitle.textContent = `Shared: ${docData.filename}`;
                    // In a real app, you'd fetch and render the PDF from storage_path
                    this.addMessage(false, `PDF Document for Shared Session: "${docData.filename}"`);
                }
            } else {
                this.pdfTitle.textContent = "Shared Session (No PDF)";
            }

            // Display chat history
            this.responseHistory.innerHTML = ''; // Clear placeholder
            sessionData.analysis_queries.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            sessionData.analysis_queries.forEach(query => {
                this.addMessage(true, query.query_text); // User query
                this.addMessage(false, query.response_text); // AI response
            });

            this.showLoading(false);
        } catch (error) {
            console.error("Error loading shared session:", error);
            this.showError(`Failed to load shared session: ${error.message}`);
            this.showLoading(false);
            // Redirect to main page or show error state
            this.pdfTitle.textContent = "Error loading shared session";
        }
    }

    openShareDialogue() {
        if (!this.currentSessionId) {
            this.showError("Please start a chat session first to generate a shareable link.");
            return;
        }
        this.shareDialogueModal.classList.remove('hidden');
        this.generateShareLink();
    }

    closeShareDialogue() {
        this.shareDialogueModal.classList.add('hidden');
        this.shareLinkInput.value = '';
    }

    async generateShareLink() {
        try {
            // Generate a unique token if not already present
            if (!this.currentSessionToken) {
                const { data, error } = await this.supabase
                    .from('analysis_sessions')
                    .update({ shared_link_token: uuidv4() })
                    .eq('id', this.currentSessionId)
                    .select('shared_link_token')
                    .single();

                if (error) throw error;
                this.currentSessionToken = data.shared_link_token;
            }

            const shareableUrl = `${window.location.origin}/?session_id=${this.currentSessionToken}`;
            this.shareLinkInput.value = shareableUrl;
        } catch (error) {
            console.error("Error generating share link:", error);
            this.shareLinkInput.value = "Error generating link.";
            this.showError("Failed to generate share link.");
        }
    }

    copyShareLink() {
        this.shareLinkInput.select();
        document.execCommand('copy');
        // Provide visual feedback
        this.copyShareLinkButton.textContent = 'Copied!';
        setTimeout(() => {
            this.copyShareLinkButton.textContent = 'Copy';
        }, 2000);
    }

    async loadSavedSessions() {
        try {
            // Assuming user is logged in. For now, we'll fetch all sessions.
            // In a real app, you'd filter by auth.uid()
            const { data, error } = await this.supabase
                .from('analysis_sessions')
                .select('id, session_name, created_at, document_id')
                .order('created_at', { ascending: false });

            if (error) throw error;

            this.renderSavedSessions(data);
        } catch (error) {
            console.error("Error loading saved sessions:", error);
            this.savedSessionsContainer.innerHTML = '<p class="text-xs text-red-500">Error loading sessions.</p>';
        }
    }

    renderSavedSessions(sessions) {
        this.savedSessionsContainer.innerHTML = ''; // Clear existing
        if (sessions.length === 0) {
            this.savedSessionsContainer.innerHTML = '<p class="text-xs text-gray-500 dark:text-gray-400">No saved chats yet.</p>';
            return;
        }

        sessions.forEach(session => {
            const sessionItem = document.createElement('div');
            sessionItem.className = 'p-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors mb-1';
            sessionItem.textContent = session.session_name || `Session ${new Date(session.created_at).toLocaleString()}`;
            sessionItem.dataset.sessionId = session.id;
            sessionItem.dataset.documentId = session.document_id; // Store document_id for later use

            sessionItem.addEventListener('click', () => this.loadSession(session.id, session.document_id));
            this.savedSessionsContainer.appendChild(sessionItem);
        });
    }

    async loadSession(sessionId, documentId) {
        try {
            this.showLoading(true);
            this.currentSessionId = sessionId;
            this.currentSessionToken = null; // Reset token when loading a new session

            // Fetch session details and queries
            const { data: sessionData, error: sessionError } = await this.supabase
                .from('analysis_sessions')
                .select('*, analysis_queries(*)')
                .eq('id', sessionId)
                .single();

            if (sessionError || !sessionData) {
                throw new Error('Session not found.');
            }

            // Clear current chat history
            this.responseHistory.innerHTML = '';

            // Load PDF if available
            if (documentId) {
                const { data: docData, error: docError } = await this.supabase
                    .from('documents')
                    .select('*')
                    .eq('id', documentId)
                    .single();
                
                if (docError || !docData) {
                    console.warn("Could not load document for session:", docError);
                    this.pdfTitle.textContent = `Session: ${sessionData.session_name || 'Untitled'} (PDF not available)`;
                } else {
                    this.pdfTitle.textContent = `Session: ${sessionData.session_name || 'Untitled'} - ${docData.filename}`;
                    // In a real app, you'd fetch and render the PDF from storage_path
                    this.addMessage(false, `PDF Document for Session: "${docData.filename}"`);
                }
            } else {
                this.pdfTitle.textContent = `Session: ${sessionData.session_name || 'Untitled'} (No PDF)`;
            }

            // Display chat history
            sessionData.analysis_queries.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            sessionData.analysis_queries.forEach(query => {
                this.addMessage(true, query.query_text); // User query
                this.addMessage(false, query.response_text); // AI response
            });

            this.showLoading(false);
        } catch (error) {
            console.error("Error loading session:", error);
            this.showError(`Failed to load session: ${error.message}`);
            this.showLoading(false);
        }
    }

    openShareDialogue() {
        if (!this.currentSessionId) {
            this.showError("Please start a chat session first to generate a shareable link.");
            return;
        }
        this.shareDialogueModal.classList.remove('hidden');
        this.generateShareLink();
    }

    closeShareDialogue() {
        this.shareDialogueModal.classList.add('hidden');
        this.shareLinkInput.value = '';
    }

    async generateShareLink() {
        try {
            // Generate a unique token if not already present
            if (!this.currentSessionToken) {
                const { data, error } = await this.supabase
                    .from('analysis_sessions')
                    .update({ shared_link_token: uuidv4() }) // Assuming uuidv4 is available or imported
                    .eq('id', this.currentSessionId)
                    .select('shared_link_token')
                    .single();

                if (error) throw error;
                this.currentSessionToken = data.shared_link_token;
            }

            const shareableUrl = `${window.location.origin}/?session_id=${this.currentSessionToken}`;
            this.shareLinkInput.value = shareableUrl;
        } catch (error) {
            console.error("Error generating share link:", error);
            this.shareLinkInput.value = "Error generating link.";
            this.showError("Failed to generate share link.");
        }
    }

    copyShareLink() {
        this.shareLinkInput.select();
        document.execCommand('copy');
        // Provide visual feedback
        this.copyShareLinkButton.textContent = 'Copied!';
        setTimeout(() => {
            this.copyShareLinkButton.textContent = 'Copy';
        }, 2000);
    }

    setupDragAndDrop() {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.fileUploadContainer.addEventListener(eventName, this.preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            this.fileUploadContainer.addEventListener(eventName, this.highlight.bind(this), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.fileUploadContainer.addEventListener(eventName, this.unhighlight.bind(this), false);
        });

        this.fileUploadContainer.addEventListener('drop', this.handleDrop.bind(this), false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    highlight() {
        this.fileUploadContainer.style.borderColor = 'var(--primary-color)';
    }

    unhighlight() {
        this.fileUploadContainer.style.borderColor = '';
    }

    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                this.loadPdfFromFile(file);
            } else {
                this.showError('Please upload a PDF file.');
            }
        }
    }

    handleFileSelect(e) {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            if (file.type === 'application/pdf') {
                this.loadPdfFromFile(file);
            } else {
                this.showError('Please upload a PDF file.');
            }
        }
    }

    async loadPdfFromFile(file) {
        try {
            this.showLoading(true);
            this.pdfTitle.textContent = `Loading: ${file.name}`;
            
            // Read the file
            const arrayBuffer = await file.arrayBuffer();
            const pdfData = new Uint8Array(arrayBuffer);
            
            // Load and render the PDF
            const pdfjsDoc = await pdfjsLib.getDocument({data: pdfData}).promise;
            this.pdfDocument = { // Store relevant info, including a placeholder for Supabase ID
                id: null, // This will be set after saving to Supabase
                name: file.name,
                numPages: pdfjsDoc.numPages,
                pdfjsDoc: pdfjsDoc // Keep the PDF.js document object
            };
            this.pdfTitle.textContent = file.name;
            
            // Show PDF viewer and hide upload container
            this.uploadContainer.classList.add('hidden');
            this.pdfViewer.classList.remove('hidden');
            
            // Render PDF and thumbnails
            await this.renderPDF();
            await this.renderThumbnails();

            // Save document to Supabase and create/load session
            const { data: userData, error: userError } = await this.supabase.auth.getUser();
            if (userError || !userData.user) {
                this.showError("Please log in to save documents and sessions.");
                this.showLoading(false);
                return;
            }
            const userId = userData.user.id;

            const { data: docInsertData, error: docInsertError } = await this.supabase
                .from('documents')
                .insert([{
                    user_id: userId,
                    filename: file.name,
                    original_filename: file.name, // Assuming original filename is the same
                    file_size: file.size,
                    mime_type: file.type,
                    storage_path: `documents/${userId}/${uuidv4()}-${file.name}`, // Placeholder path
                    status: 'ready', // Assuming immediate readiness for now
                    page_count: this.pdfDocument.numPages,
                    text_content: this.pdfText // Full text content
                }])
                .select()
                .single();

            if (docInsertError) throw docInsertError;
            this.pdfDocument.id = docInsertData.id; // Set the Supabase ID for the document

            // Create or load an analysis session for this document
            await this.createOrLoadSession(this.pdfDocument.id);
            
            // Add welcome message
            this.addMessage(false, `PDF Document Loaded: "${file.name}"`);
            
            this.showLoading(false);
        } catch (error) {
            console.error("Error loading PDF:", error);
            this.pdfTitle.textContent = "Error loading PDF";
            this.showError(`Failed to load PDF: ${error.message}`);
            this.showLoading(false);
        }
    }

    async renderPDF() {
        this.pdfRenderContainer.innerHTML = '';
        this.pageContents = [];
        
        for (let i = 1; i <= this.pdfDocument.numPages; i++) {
            const page = await this.pdfDocument.getPage(i);
            
            // Create a canvas for rendering
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            const viewport = page.getViewport({scale: 1.5});
            
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            // Render the page
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Get text content
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            this.pageContents.push({
                pageNum: i,
                text: pageText
            });
            
            this.pdfRenderContainer.appendChild(canvas);
        }
        
        // Combine all page contents
        this.pdfText = this.pageContents.map(page => page.text).join(' ');
    }

    async renderThumbnails() {
        this.thumbnailsContainer.innerHTML = '';
        
        for (let i = 1; i <= this.pdfDocument.numPages; i++) {
            const thumbnailContainer = document.createElement('div');
            thumbnailContainer.className = `thumbnail-container ${i === this.currentPage ? 'active' : ''}`;
            thumbnailContainer.dataset.page = i;
            
            const canvas = document.createElement('canvas');
            const page = await this.pdfDocument.getPage(i);
            const viewport = page.getViewport({scale: 0.2});
            
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            const ctx = canvas.getContext('2d');
            await page.render({
                canvasContext: ctx,
                viewport: viewport
            }).promise;
            
            // Add page number overlay
            const pageNumber = document.createElement('div');
            pageNumber.className = 'page-number';
            pageNumber.textContent = i;
            
            thumbnailContainer.appendChild(canvas);
            thumbnailContainer.appendChild(pageNumber);
            this.thumbnailsContainer.appendChild(thumbnailContainer);
            
            // Add click event to navigate to page
            thumbnailContainer.addEventListener('click', () => this.navigateToPage(i));
        }
    }

    navigateToPage(pageNumber) {
        if (pageNumber < 1 || pageNumber > this.pdfDocument.numPages) return;
        
        this.currentPage = pageNumber;
        
        // Update active thumbnail
        const thumbnails = document.querySelectorAll('.thumbnail-container');
        thumbnails.forEach(thumb => {
            if (parseInt(thumb.dataset.page) === pageNumber) {
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }
        });
        
        // Scroll to the canvas of the selected page
        const canvases = document.querySelectorAll('#pdf-render-container canvas');
        if (canvases[pageNumber - 1]) {
            canvases[pageNumber - 1].scrollIntoView({ behavior: 'smooth' });
        }
    }

    async handleQuestionSubmit(e) {
        e.preventDefault();
        const question = this.questionInput.value.trim();
        
        if (question && this.pdfText) {
            this.addMessage(true, question);
            this.questionInput.value = '';
            this.autoResizeTextarea();
            
            // Show loading message
            const loadingMessage = this.addMessage(false, 'Analyzing document...', true);
            
            try {
                const response = await this.analyzeDocument(question);
                this.removeMessage(loadingMessage);
                this.addMessage(false, response);
                
                // Save query and response to Supabase
                await this.saveQueryToSession(question, response);
            } catch (error) {
                this.removeMessage(loadingMessage);
                this.addMessage(false, `Error: ${error.message}`);
            }
        }
    }

    handleTemplateClick(e) {
        const template = e.target.dataset.template;
        const templates = {
            'legal-risks': 'Identify and analyze all potential legal risks, liabilities, and compliance issues in this document.',
            'key-terms': 'Extract and explain all key terms, definitions, and important concepts from this document.',
            'obligations': 'List all obligations, responsibilities, and requirements outlined in this document.',
            'red-flags': 'Identify any red flags, concerning clauses, or potential issues that require attention.',
            'summary': 'Provide a comprehensive summary of this document including main points and key takeaways.',
            'line-analysis': 'Perform a detailed line-by-line analysis of this document, highlighting important sections.'
        };
        
        if (templates[template]) {
            this.questionInput.value = templates[template];
            this.autoResizeTextarea();
            
            // If PDF is loaded, automatically submit
            if (this.pdfText) {
                this.handleQuestionSubmit(new Event('submit'));
            }
        }
    }

    async analyzeDocument(question) {
        // For now, simulate intelligent analysis with citations
        return new Promise((resolve) => {
            setTimeout(() => {
                const analysis = this.generateIntelligentAnalysis(question);
                resolve(analysis);
            }, 2000);
        });
    }

    generateIntelligentAnalysis(question) {
        // Simulate intelligent analysis based on document content
        const sampleAnalyses = {
            'legal-risks': this.generateLegalRisksAnalysis(),
            'key-terms': this.generateKeyTermsAnalysis(),
            'obligations': this.generateObligationsAnalysis(),
            'red-flags': this.generateRedFlagsAnalysis(),
            'summary': this.generateSummaryAnalysis(),
            'line-analysis': this.generateLineAnalysis()
        };

        // Check if question matches a template
        for (const [template, analysis] of Object.entries(sampleAnalyses)) {
            if (question.toLowerCase().includes(template.replace('-', ' ')) || 
                question.toLowerCase().includes(template.replace('-', ''))) {
                return analysis;
            }
        }

        // Default contextual analysis
        return this.generateContextualAnalysis(question);
    }

    generateLegalRisksAnalysis() {
        return `Based on the document analysis, here are the key legal risks identified:

**High Priority Risks:**
• Liability exposure in sections discussing responsibility allocation <cite data-page="1">1</cite>
• Compliance requirements that may conflict with current practices <cite data-page="2">2</cite>
• Indemnification clauses that could create financial exposure <cite data-page="3">3</cite>

**Medium Priority Risks:**
• Termination provisions that lack adequate notice periods <cite data-page="1">4</cite>
• Intellectual property ownership ambiguities <cite data-page="2">5</cite>

**Recommendations:**
Review all highlighted sections with legal counsel before proceeding. Pay particular attention to the liability and indemnification terms <cite data-page="3">6</cite>.`;
    }

    generateKeyTermsAnalysis() {
        return `Key terms and definitions identified in the document:

**Primary Definitions:**
• **Party/Parties**: Referenced throughout as the contracting entities <cite data-page="1">1</cite>
• **Effective Date**: The commencement date for all obligations <cite data-page="1">2</cite>
• **Confidential Information**: Broadly defined to include proprietary data <cite data-page="2">3</cite>

**Important Concepts:**
• **Force Majeure**: Events beyond reasonable control affecting performance <cite data-page="2">4</cite>
• **Material Breach**: Significant violations triggering termination rights <cite data-page="3">5</cite>

**Critical Terms Requiring Attention:**
The definition of "material breach" is particularly broad and could be interpreted subjectively <cite data-page="3">6</cite>.`;
    }

    generateObligationsAnalysis() {
        return `Analysis of obligations and responsibilities:

**Primary Obligations:**
• Maintain confidentiality of all shared information <cite data-page="1">1</cite>
• Provide timely notice of any material changes <cite data-page="1">2</cite>
• Comply with all applicable laws and regulations <cite data-page="2">3</cite>

**Performance Standards:**
• Meet specified delivery timelines as outlined <cite data-page="2">4</cite>
• Maintain professional standards throughout engagement <cite data-page="3">5</cite>

**Ongoing Responsibilities:**
• Regular reporting requirements as specified <cite data-page="3">6</cite>
• Cooperation with audits and compliance reviews <cite data-page="3">7</cite>

**Critical Note:** Failure to meet these obligations could result in immediate termination <cite data-page="3">8</cite>.`;
    }

    generateRedFlagsAnalysis() {
        return `🚨 **Red Flags Identified:**

**Immediate Concerns:**
• Unlimited liability exposure without caps <cite data-page="1">1</cite>
• Broad indemnification requirements favoring one party <cite data-page="2">2</cite>
• Vague termination triggers that could be misused <cite data-page="2">3</cite>

**Contractual Issues:**
• One-sided modification rights <cite data-page="1">4</cite>
• Inadequate dispute resolution mechanisms <cite data-page="3">5</cite>
• Missing force majeure protections <cite data-page="3">6</cite>

**Financial Risks:**
• Payment terms heavily favor the counterparty <cite data-page="2">7</cite>
• No protection against cost escalations <cite data-page="3">8</cite>

**Recommendation:** These issues should be addressed before signing. Consider negotiating more balanced terms.`;
    }

    generateSummaryAnalysis() {
        return `**Document Summary:**

**Overview:**
This document appears to be a contractual agreement establishing terms between parties for ongoing collaboration <cite data-page="1">1</cite>.

**Key Sections:**
• **Introduction & Definitions**: Establishes the framework and key terms <cite data-page="1">2</cite>
• **Scope of Work**: Details the specific obligations and deliverables <cite data-page="2">3</cite>
• **Terms & Conditions**: Outlines legal requirements and compliance <cite data-page="2">4</cite>
• **Termination & Remedies**: Specifies end conditions and dispute resolution <cite data-page="3">5</cite>

**Main Themes:**
The document emphasizes mutual cooperation while establishing clear boundaries for responsibility and liability <cite data-page="1,2,3">6</cite>.

**Overall Assessment:**
This is a comprehensive agreement that requires careful review of the liability and termination provisions before execution.`;
    }

    generateLineAnalysis() {
        return `**Detailed Line-by-Line Analysis:**

**Section 1 - Opening Provisions:**
Lines 1-15: Standard preamble establishing parties and effective date <cite data-page="1">1</cite>
Lines 16-30: Definitions section - note broad interpretation of "confidential information" <cite data-page="1">2</cite>

**Section 2 - Core Obligations:**
Lines 31-45: Primary performance requirements clearly stated <cite data-page="2">3</cite>
Lines 46-60: Payment terms - review for fairness <cite data-page="2">4</cite>
Lines 61-75: Compliance requirements - ensure feasibility <cite data-page="2">5</cite>

**Section 3 - Risk Allocation:**
Lines 76-90: Liability provisions - significant exposure identified <cite data-page="3">6</cite>
Lines 91-105: Indemnification - heavily favors one party <cite data-page="3">7</cite>

**Critical Lines Requiring Immediate Attention:**
Lines 85-87 contain unlimited liability language <cite data-page="3">8</cite>
Lines 98-100 establish broad indemnification scope <cite data-page="3">9</cite>`;
    }

    generateContextualAnalysis(question) {
        return `**Analysis for: "${question}"**

Based on the document content, here is the contextual analysis:

**Key Findings:**
• The document contains relevant information addressing your question <cite data-page="1">1</cite>
• Multiple sections provide context for this inquiry <cite data-page="2">2</cite>
• Cross-references to related provisions are important <cite data-page="2,3">3</cite>

**Detailed Response:**
The document addresses this topic through several mechanisms and provisions <cite data-page="1">4</cite>. The primary discussion occurs in the middle sections <cite data-page="2">5</cite>, with supporting details provided in the concluding portions <cite data-page="3">6</cite>.

**Recommendations:**
Review the cited sections carefully and consider how they interact with other document provisions <cite data-page="1,2,3">7</cite>.

*Note: This is a simulated analysis. In production, this would be replaced with actual AI analysis from your chosen model (Claude, GPT-4, etc.).*`;
    }

    addMessage(isUser, content, isLoading = false) {
        const historyContainer = this.responseHistory;
        const messageElement = document.createElement('div');
        messageElement.className = `p-4 mb-2 rounded ${isUser ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}`;
        
        if (isLoading) {
            messageElement.classList.add('loading-message');
        }
        
        const timestampElement = document.createElement('div');
        timestampElement.className = 'timestamp';
        timestampElement.textContent = this.getTimestamp();
        
        const contentContainer = document.createElement('div');
        contentContainer.className = 'mt-1';
        
        if (isLoading) {
            contentContainer.innerHTML = `
                <div class="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span class="ml-2">${content}</span>
            `;
        } else {
            if (isUser) {
                contentContainer.textContent = content;
            } else {
                // Process content with citations for AI responses
                contentContainer.innerHTML = this.processCitations(content);
                // Add click handlers for citations
                this.addCitationHandlers(contentContainer);
            }
        }
        
        messageElement.appendChild(timestampElement);
        messageElement.appendChild(contentContainer);
        
        // Remove placeholder if it exists
        const placeholder = historyContainer.querySelector('.flex.items-center.justify-center');
        if (placeholder) {
            historyContainer.innerHTML = '';
        }
        
        historyContainer.appendChild(messageElement);
        historyContainer.scrollTop = historyContainer.scrollHeight;
        
        return messageElement;
    }

    processCitations(content) {
        // Convert markdown-style formatting to HTML
        let processedContent = content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/•/g, '•')
            .replace(/🚨/g, '🚨');

        // Process citation tags
        processedContent = processedContent.replace(
            /<cite data-page="([^"]+)">(\d+)<\/cite>/g,
            '<span class="citation-link" data-page="$1" data-citation="$2">$2</span>'
        );

        // Convert line breaks to HTML
        processedContent = processedContent.replace(/\n/g, '<br>');

        return processedContent;
    }

    addCitationHandlers(container) {
        const citations = container.querySelectorAll('.citation-link');
        citations.forEach(citation => {
            citation.addEventListener('click', (e) => {
                e.preventDefault();
                const pageData = citation.dataset.page;
                const citationNumber = citation.dataset.citation;
                
                // Handle multiple pages (e.g., "1,2,3")
                const pages = pageData.split(',').map(p => parseInt(p.trim()));
                const targetPage = pages[0]; // Navigate to first page if multiple
                
                this.navigateToPage(targetPage);
                
                // Add visual feedback
                citation.style.backgroundColor = 'rgba(93, 92, 222, 0.4)';
                setTimeout(() => {
                    citation.style.backgroundColor = '';
                }, 1000);
            });
        });
    }

    removeMessage(messageElement) {
        if (messageElement && messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }

    getTimestamp() {
        const now = new Date();
        return now.toLocaleString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    autoResizeTextarea() {
        this.questionInput.style.height = 'auto';
        this.questionInput.style.height = Math.min(this.questionInput.scrollHeight, 120) + 'px';
    }

    showLoading(show) {
        if (show) {
            this.loadingOverlay.classList.remove('hidden');
        } else {
            this.loadingOverlay.classList.add('hidden');
        }
    }

    showError(message) {
        alert(message); // Replace with better error handling
    }

    async connectToSupabase() {
        try {
            this.supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
            
            // Test connection
            const { data, error } = await this.supabase.from('documents').select('count').limit(1);
            
            if (error) throw error;
            
            this.isConnected = true;
            this.updateConnectionStatus();
            console.log('Connected to Supabase successfully');
        } catch (error) {
            console.error('Failed to connect to Supabase:', error);
            this.isConnected = false;
            this.updateConnectionStatus();
        }
    }

    updateConnectionStatus() {
        const indicator = this.connectionStatus.querySelector('.status-indicator');
        const text = this.connectionStatus.querySelector('.status-text');
        
        if (this.isConnected) {
            indicator.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            indicator.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }

    async saveToSupabase(documentData) {
        if (!this.isConnected) {
            throw new Error('Not connected to Supabase');
        }
        
        try {
            const { data, error } = await this.supabase
                .from('documents')
                .insert([documentData]);
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error saving to Supabase:', error);
            throw error;
        }
    }

    async createOrLoadSession(documentId) {
        // For now, create a new session every time a PDF is loaded
        // In a real app, you'd check for an existing session for this document/user
        try {
            const { data, error } = await this.supabase
                .from('analysis_sessions')
                .insert([{ 
                    user_id: (await this.supabase.auth.getUser()).data.user.id, // Assuming user is logged in
                    document_id: documentId,
                    session_name: `Session for ${this.pdfDocument.name || 'Untitled PDF'}`
                }])
                .select()
                .single();

            if (error) throw error;
            this.currentSessionId = data.id;
            this.currentSessionToken = data.shared_link_token; // Will be null initially
            this.loadSavedSessions(); // Refresh saved sessions list
            console.log('New analysis session created:', this.currentSessionId);
        } catch (error) {
            console.error('Error creating analysis session:', error);
            this.showError('Failed to create analysis session.');
        }
    }

    async saveQueryToSession(queryText, responseText) {
        if (!this.currentSessionId) {
            console.error('No active session to save query to.');
            return;
        }
        try {
            const { error } = await this.supabase
                .from('analysis_queries')
                .insert([{
                    session_id: this.currentSessionId,
                    user_id: (await this.supabase.auth.getUser()).data.user.id, // Assuming user is logged in
                    document_id: this.pdfDocument.id, // Assuming pdfDocument has an ID from Supabase
                    query_text: queryText,
                    response_text: responseText,
                    analysis_type: 'custom' // Or infer from template
                }]);
            if (error) throw error;
            console.log('Query saved to session:', this.currentSessionId);
        } catch (error) {
            console.error('Error saving query to session:', error);
        }
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new PDFReaderAI();
    
    // Initialize the application logic (connect to Supabase or load shared session)
    app.initializeApplication();
    
    // Make app globally available for debugging
    window.pdfReaderAI = app;
});
