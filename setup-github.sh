#!/bin/bash

echo "🚀 Setting up GitHub repository for LocalOps AI"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Please install it from: https://cli.github.com/"
    echo ""
    echo "Or set up manually:"
    echo "1. Create a new repository on GitHub.com"
    echo "2. Run: git remote add origin https://github.com/yourusername/localops-ai.git"
    echo "3. Run: git push -u origin main"
    exit 1
fi

# Check if user is logged in to GitHub CLI
if ! gh auth status &> /dev/null; then
    echo "🔐 Please log in to GitHub CLI first:"
    echo "gh auth login"
    exit 1
fi

echo "📝 Creating GitHub repository..."

# Create the repository
gh repo create localops-ai \
    --description "AI-powered workforce management platform with real-time chat, email notifications, and intelligent scheduling" \
    --public \
    --clone=false \
    --add-readme=false

if [ $? -eq 0 ]; then
    echo "✅ Repository created successfully!"
    
    # Add remote origin
    git remote add origin https://github.com/$(gh api user --jq .login)/localops-ai.git
    
    # Push to GitHub
    echo "📤 Pushing code to GitHub..."
    git push -u origin main
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "🎉 Success! Your repository is now on GitHub:"
        echo "https://github.com/$(gh api user --jq .login)/localops-ai"
        echo ""
        echo "🔧 Next steps:"
        echo "1. Set up Vercel deployment (optional)"
        echo "2. Configure repository secrets for CI/CD:"
        echo "   - VERCEL_TOKEN"
        echo "   - VERCEL_ORG_ID" 
        echo "   - VERCEL_PROJECT_ID"
        echo "3. Enable GitHub Pages for documentation (optional)"
        echo "4. Set up branch protection rules"
        echo ""
        echo "📚 Documentation:"
        echo "- README.md - Main project documentation"
        echo "- CONTRIBUTING.md - Contribution guidelines"
        echo "- CHAT_AND_EMAIL_SETUP.md - Communication features setup"
        echo "- DEMO_SETUP.md - Demo data setup guide"
    else
        echo "❌ Failed to push to GitHub. Please check your permissions."
    fi
else
    echo "❌ Failed to create repository. It might already exist or you don't have permissions."
    echo ""
    echo "Manual setup:"
    echo "1. Go to https://github.com/new"
    echo "2. Create a repository named 'localops-ai'"
    echo "3. Run: git remote add origin https://github.com/yourusername/localops-ai.git"
    echo "4. Run: git push -u origin main"
fi