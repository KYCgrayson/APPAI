# Contributing to AppAI

Thank you for your interest in contributing to AppAI!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/AIGA.git`
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env.local` and configure your environment variables
5. Run the development server: `npm run dev`

## Development

- This is a [Next.js](https://nextjs.org/) project with App Router
- Database: PostgreSQL with Prisma ORM
- Authentication: NextAuth.js + Device Authorization Flow (RFC 8628)

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes
3. Ensure the build passes: `npm run build`
4. Submit a pull request with a clear description of your changes

## Code Style

- TypeScript strict mode
- Follow existing patterns in the codebase
- Use Zod for input validation

## Reporting Issues

Please use [GitHub Issues](https://github.com/KYCgrayson/AIGA/issues) to report bugs or request features.
