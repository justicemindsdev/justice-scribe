#!/bin/bash

# PDF Reader AI - Deployment Script
# This script handles the complete deployment process

echo "🚀 PDF Reader AI - Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        print_error "Git is not installed. Please install Git first."
        exit 1
    fi
    
    print_success "All dependencies are installed"
}

# Install project dependencies
install_dependencies() {
    print_status "Installing project dependencies..."
    
    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
}

# Initialize Git repository if not already initialized
init_git() {
    if [ ! -d ".git" ]; then
        print_status "Initializing Git repository..."
        git init
        git branch -M main
        print_success "Git repository initialized"
    else
        print_status "Git repository already exists"
    fi
}

# Install Vercel CLI if not installed
install_vercel_cli() {
    if ! command -v vercel &> /dev/null; then
        print_status "Installing Vercel CLI..."
        npm install -g vercel
        print_success "Vercel CLI installed"
    else
        print_status "Vercel CLI already installed"
    fi
}

# Deploy to Vercel
deploy_to_vercel() {
    print_status "Deploying to Vercel..."
    
    # Login check
    if ! vercel whoami &> /dev/null; then
        print_warning "Not logged in to Vercel. Please login:"
        vercel login
    fi
    
    # Deploy
    if vercel --prod; then
        print_success "Deployment successful!"
        print_status "Your PDF Reader AI is now live!"
    else
        print_error "Deployment failed"
        exit 1
    fi
}

# Setup Supabase (optional)
setup_supabase() {
    read -p "Do you want to set up Supabase CLI? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Installing Supabase CLI..."
        
        # Install Supabase CLI
        if command -v brew &> /dev/null; then
            brew install supabase/tap/supabase
        else
            npm install -g supabase
        fi
        
        print_status "Supabase CLI installed. You can now run:"
        echo "  supabase login"
        echo "  supabase link --project-ref tvecnfdqakrevzaeifpk"
    fi
}

# Main deployment process
main() {
    echo
    print_status "Starting deployment process..."
    echo
    
    # Step 1: Check dependencies
    check_dependencies
    echo
    
    # Step 2: Install project dependencies
    install_dependencies
    echo
    
    # Step 3: Initialize Git
    init_git
    echo
    
    # Step 4: Install Vercel CLI
    install_vercel_cli
    echo
    
    # Step 5: Deploy to Vercel
    deploy_to_vercel
    echo
    
    # Step 6: Optional Supabase setup
    setup_supabase
    echo
    
    print_success "Deployment process completed!"
    echo
    print_status "Next steps:"
    echo "  1. Your app is now live on Vercel"
    echo "  2. Test the PDF upload and AI analysis features"
    echo "  3. Monitor the Vercel dashboard for performance"
    echo "  4. Check Supabase dashboard for database activity"
    echo
    print_status "Useful commands:"
    echo "  vercel --prod          # Deploy to production"
    echo "  vercel dev             # Run local development server"
    echo "  vercel logs            # View deployment logs"
    echo "  supabase status        # Check Supabase connection"
    echo
}

# Run the main function
main

# Exit successfully
exit 0
