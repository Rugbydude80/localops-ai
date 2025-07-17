# Contributing to LocalOps AI

Thank you for your interest in contributing to LocalOps AI! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- Git
- Supabase account (for database)
- Email service account (Resend or SendGrid)

### Development Setup
1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/localops-ai.git`
3. Install dependencies:
   ```bash
   cd frontend && npm install
   cd ../backend && pip install -r requirements.txt
   ```
4. Set up environment variables (see `.env.example` files)
5. Run database setup: `cd frontend && node scripts/setup-database.js`
6. Start development servers: `./run-dev.sh`

## 📋 Development Guidelines

### Code Style
- **Frontend**: Use TypeScript, follow ESLint rules, use Tailwind CSS
- **Backend**: Follow PEP 8, use type hints, document functions
- **Database**: Use descriptive table/column names, include proper indexes

### Commit Messages
Use conventional commits format:
```
type(scope): description

feat(chat): add real-time message reactions
fix(email): resolve template rendering issue
docs(readme): update setup instructions
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branch Naming
- Feature branches: `feature/description-of-feature`
- Bug fixes: `fix/description-of-bug`
- Documentation: `docs/description-of-change`

## 🏗 Architecture Overview

### Frontend Structure
```
frontend/src/
├── components/     # Reusable UI components
├── pages/         # Next.js pages and API routes
├── hooks/         # Custom React hooks
├── lib/           # Utilities and services
└── styles/        # Global styles
```

### Backend Structure
```
backend/
├── services/      # Business logic and AI services
├── models.py     # Database models
├── schemas.py    # Pydantic schemas
├── main.py       # FastAPI application
└── database.py   # Database configuration
```

## 🧪 Testing

### Frontend Testing
```bash
cd frontend
npm run test        # Run tests
npm run test:watch  # Watch mode
npm run lint        # Linting
npm run type-check  # TypeScript checking
```

### Backend Testing
```bash
cd backend
python -m pytest tests/ -v    # Run tests
flake8 .                      # Linting
mypy .                        # Type checking
```

## 🔧 Feature Development

### Adding New Features
1. Create an issue describing the feature
2. Create a feature branch
3. Implement the feature with tests
4. Update documentation
5. Submit a pull request

### Chat System Development
- Use Supabase Realtime for real-time features
- Test with multiple users/conversations
- Ensure proper error handling for WebSocket connections

### Email Notification Development
- Test with both Resend and SendGrid
- Include both HTML and text versions
- Log all email activity to `message_logs` table

### AI Service Development
- Use proper error handling for API calls
- Include fallback mechanisms
- Document AI model requirements and limitations

## 📊 Database Changes

### Schema Migrations
1. Create SQL migration files in `frontend/scripts/`
2. Update TypeScript interfaces in `frontend/src/lib/supabase.ts`
3. Test migrations on clean database
4. Document breaking changes

### Adding New Tables
```sql
-- Example migration file: add-new-feature.sql
CREATE TABLE IF NOT EXISTS public.new_feature (
  id SERIAL PRIMARY KEY,
  business_id INTEGER REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS for demo (enable for production)
ALTER TABLE public.new_feature DISABLE ROW LEVEL SECURITY;
```

## 🚀 Deployment

### Preview Deployments
- Pull requests automatically deploy to Vercel preview
- Backend changes require manual testing

### Production Deployment
- Merges to `main` branch deploy to production
- Database migrations must be backward compatible
- Monitor deployment logs and metrics

## 🐛 Bug Reports

### Before Reporting
1. Check existing issues
2. Test on latest version
3. Reproduce the bug consistently

### Bug Report Template
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, browser, versions)
- Screenshots or logs if applicable

## 💡 Feature Requests

### Good Feature Requests Include
- Clear problem statement
- Proposed solution
- Alternative approaches considered
- Implementation ideas (if any)
- Affected components

## 📚 Documentation

### Documentation Standards
- Keep README.md up to date
- Document all API endpoints
- Include code examples
- Update setup guides for new features

### API Documentation
- Use OpenAPI/Swagger standards
- Include request/response examples
- Document error codes and messages

## 🤝 Code Review Process

### For Contributors
- Keep PRs focused and small
- Write clear PR descriptions
- Respond to feedback promptly
- Test your changes thoroughly

### For Reviewers
- Be constructive and helpful
- Test the changes locally
- Check for security issues
- Verify documentation updates

## 🔒 Security

### Security Guidelines
- Never commit API keys or secrets
- Use environment variables for configuration
- Validate all user inputs
- Follow OWASP security practices

### Reporting Security Issues
- Email security issues to: security@localops.ai
- Do not create public issues for security vulnerabilities
- Allow time for fixes before public disclosure

## 📞 Getting Help

### Community Support
- GitHub Discussions for questions
- GitHub Issues for bugs and features
- Discord community (link in README)

### Development Help
- Check existing documentation
- Look at similar implementations in the codebase
- Ask questions in pull request comments

## 🎉 Recognition

Contributors are recognized in:
- GitHub contributors list
- Release notes for significant contributions
- Special mentions for major features

Thank you for contributing to LocalOps AI! 🚀