# LocallyCLI

LocallyCLI is a tool for easily setting up custom localhost domains with the `.local` TLD. 

## Features

An efficient way to set up, manage and remove custom `.local` domains for your local development environment, all so that you can focus on building your project on HTTPS locally.

- ☑️ Add custom `.local` domains to your `/etc/hosts` file.
- ☑️ Automatically generate self-signed certificates for your custom domains in your project directory.
- ☑️ Automatically install the generated certificates in your system keychain.
- ☑️ Automatically configure your local server to use the generated certificates.

## Future Work

- [ ] Docs
- [ ] Tests (yes, I know)
- [ ] Typescript
- [ ] Detect NextJS + modify package.json directly to use the generated certificates

## Pre-requisites

This tool requires the following to be installed on your system:

1. Shell + Homebrew
2. Node.js (> v18.0.0)

## Installation

1. Clone this repository.
2. Navigate to the repository root and run `node main.js init` to initialize the package.

## Usage

Before you can use LocallyCLI, you need to initialize it:

```bash
# For first time users
node main.js init

# If you have already initialized LocallyCLI and want to reinitialize it
locally init
```

This will check if `mkcert` is installed, install it if necessary, set up the required permissions, and modify your `/etc/hosts` file.

After initialization, you can use the following commands:

- `locally list`: List all domains installed by LocallyJS and the status of the self-signed certificate.
- `locally add [domain]`: Add a new local domain with https (exclude .local).
- `locally rm [domain]`: Remove a local domain with https (exclude.local).

## Disclaimers
This tool is a work in progress and is not yet ready for production use. Use at your own risk.

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
MIT
