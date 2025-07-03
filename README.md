# PDF Reader AI

Advanced PDF Reader with AI Analysis and Supabase Integration

## Features

- 📄 **PDF Viewing**: Full-featured PDF viewer with zoom, navigation, and page controls
- 🤖 **AI Analysis**: Ask questions about your documents using top AI models (Claude, GPT-4, etc.)
- 🔍 **Line-by-Line Analysis**: Surgical precision analysis of document content
- 💾 **Cloud Storage**: Automatic document storage and conversation history via Supabase
- 🎯 **Quick Templates**: Pre-built analysis templates for legal risks, key terms, obligations, etc.
- 🔒 **Secure**: Row-level security and proper authentication handling

## AI Models Supported

- **Claude 3.5 Sonnet** (4.7★) - Best for complex legal analysis
- **GPT-4o** (4.1★) - Excellent for general document analysis
- **Claude 3 Opus** (4.5★) - Superior reasoning capabilities
- **GPT-4 Turbo** (4.0★) - Fast and efficient analysis
- **Gemini Pro** (3.9★) - Good for structured data extraction

## Quick Start

### 1. Clone and Setup
```bash
git clone <your-repo-url>
cd pdf-reader-ai
npm install
```

### 2. Environment Setup
The application is pre-configured with Supabase credentials. No additional setup required for basic usage.

### 3. Local Development
```bash
npm run dev
```

### 4. Deploy to Vercel
```bash
npm run deploy
```

## Deployment Instructions

### Option 1: One-Click Vercel Deployment
1. Fork this repository
2. Connect to Vercel
3. Deploy automatically with pre-configured settings

### Option 2: Manual Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### Option 3: CLI Deployment Script
```bash
# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

## Database Schema

The application uses the following Supabase tables:

- **documents**: Store PDF metadata and file information
- **document_pages**: Store extracted text content for each page
- **conversations**: Track AI analysis sessions
- **messages**: Store questions and AI responses
- **highlights**: Save user highlights and annotations

## Configuration

### Supabase Configuration
- **URL**: `https://tvecnfdqakrevzaeifpk.supabase.co`
- **Project**: Evidentia
- **Region**: EU West 2

### OpenRouter API
- **Models**: Claude 3.5 Sonnet, GPT-4o, Claude 3 Opus, GPT-4 Turbo, Gemini Pro
- **Features**: Precision legal analysis, line-by-line breakdown, template analysis

## Usage

### 1. Upload PDF
- Click "Upload PDF" or drag and drop a PDF file
- Document will be processed and stored automatically

### 2. Ask Questions
- Type your question in the analysis panel
- Select your preferred AI model
- Click "Analyze" for instant results

### 3. Use Templates
- Click quick analysis buttons for common tasks:
  - Legal Risks
  - Key Terms
  - Obligations
  - Red Flags
  - Summary

### 4. Line-by-Line Analysis
- Click "Line-by-Line" for surgical precision analysis
- Each line will be analyzed for legal implications and risks

## API Integration

### OpenRouter Integration
```javascript
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        model: 'claude-3-5-sonnet',
        messages: [/* your messages */]
    })
});
```

### Supabase Integration
```javascript
const { data, error } = await supabase
    .from('documents')
    .insert({
        title: file.name,
        file_path: uploadData.path,
        file_size: file.size,
        page_count: extracted.pageCount
    });
```

## Security Features

- Row Level Security (RLS) enabled on all tables
- Secure file upload with user isolation
- API key protection and environment variable management
- CORS and security headers configured

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Performance

- Optimized PDF rendering with canvas
- Efficient text extraction and processing
- Lazy loading for large documents
- Responsive design for all screen sizes

## Development

### Project Structure
```
pdf-reader-ai/
├── index.html          # Main HTML file
├── app.js              # Main application logic
├── config.js           # Configuration and credentials
├── styles.css          # Styling and responsive design
├── package.json        # Dependencies and scripts
├── vercel.json         # Vercel deployment configuration
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

### Key Components
- **PDFReaderAI Class**: Main application controller
- **PDF Processing**: Text extraction and rendering
- **AI Integration**: OpenRouter API communication
- **Supabase Client**: Database and storage operations
- **UI Management**: Event handling and state management

## Troubleshooting

### Common Issues

1. **PDF Not Loading**
   - Ensure PDF is valid and not corrupted
   - Check browser console for errors
   - Verify PDF.js worker is loading correctly

2. **AI Analysis Failing**
   - Check OpenRouter API key validity
   - Verify internet connection
   - Ensure document content was extracted properly

3. **Supabase Connection Issues**
   - Verify Supabase URL and keys
   - Check network connectivity
   - Review browser console for authentication errors

### Debug Mode
Enable debug logging by opening browser console and running:
```javascript
localStorage.setItem('debug', 'true');
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review browser console for error messages

## Changelog

### v1.0.0
- Initial release
- PDF viewing and text extraction
- AI analysis with multiple models
- Supabase integration
- Vercel deployment ready
- Line-by-line analysis feature
- Quick analysis templates
