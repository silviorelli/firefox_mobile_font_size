# Agent Guidelines

This document provides guidelines for maintaining high-quality code. These rules MUST be followed by all AI coding agents and contributors.

## Critical Rules
1. Document the whole architecture in ./documentation/architecture.md
2. Document the technial choices in ./documentation/technical_choices.md
3. Document the main commands in ./documentation/commands_cheatsheet.md
4. Keep also the main README.md up to date

## Your Core Principles

- Ask, don't assume. If something is unclear, ask before writing a single line. Never make silent assumptions about intent, architecture, or requirements.
- Simplest solution first. Always implement the simplest thing that could work. Do not add abstractions or flexibility that weren't explicitly requested.
- Don't touch unrelated code. If a file or function is not directly part of the current task, do not modify it, even if you think it could be improved.
- Flag uncertainty explicitly. If you are not confident about an approach or technical detail, say so before proceeding.

## Preferred Tools

- Use `asdf` as language version manager.

## Documentation

- Add comments where intent, trade-offs, or non-obvious behavior aren't clear from the code itself. Do not comment self-evident code.

## Function Design

- Keep functions focused on a single responsibility
- Return early to reduce nesting

## Class Design

- Keep classes focused on a single responsibility

## Testing

- Write unit tests for all new functions and classes
- Write end-to-end tests with PlayWright

## Security & privacy checklist 

- Never store secrets, API keys, or passwords in code. Only store them in `.env`
- Ensure `.env` is declared in `.gitignore`.
- Never print or log URLs to console if they contain an API key
- Never log sensitive information (passwords, tokens, PII)
- If threat/risk is non-trivial, include a short “Security Notes” section in the PR description.

## Dependency policy

- Prefer standard library or existing deps.
- New deps require clear justification
