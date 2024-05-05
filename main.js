#!/usr/bin/env node
const program = require('commander');
const inquirer = require('inquirer');
const shell = require('shelljs');
const fs = require('fs');

// Constants
const config = {
  version: 'v0.1.0',
  pathToHostsFile: '/etc/hosts',
  defaultCertDir: '_localcerts',
}

/**
 * @function locally -v
 * @description Display the version of locallyCLI
 * @returns {void}, prints version of locallyCLI in terminal
*/
program
  .command('version')
  .description('Display the version of locallyCLI')
  .action(() => {
    shell.echo('locallyCLI ' + config.version);
  });

/**
 * @function locally init
 * @description Initialize the locally tool
 * @returns {void}
 * @example pnpm locally init
 */
program
  .command('init')
  .description('Initialize the locally tool')
  .action(() => {
    shell.echo('Script started. \n . \n .. \n ...');
    shell.echo('Running initial setup for locallyCLI...');
    // Check if mkcert is installed and install it
    // if installation failure, exit script
    if (!shell.which('mkcert')) {
      shell.echo('mkcert is not installed. Installing it now... \n . \n .. \n ...');
      if (shell.exec('brew install mkcert').code !== 0) {
        shell.echo('Error: mkcert installation failed');
        shell.exit(1);
      }
    }
    // Echo mkcert installation path and version
    shell.echo('mkcert installed at: ' + shell.which('mkcert'));
    shell.echo('mkcert version: ' + shell.exec('mkcert -version', {silent: true}).stdout);

    // Set up permissions to run locally.js as executable
    shell.echo('...');
    shell.echo('Setting up permissions to run locally.js as executable. This requires sudo permission.');
    // ask user if they want to proceed with sudo permissions
    inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Would you like to proceed? (y/n)',
      }
    ]).then(answers => {
      if (answers.proceed) {
        // make main.js for locallyCLI an executable to run as "locally"
        shell.echo('(1/7) Setting up permissions to run locallyCLI as executable...');
        shell.exec(`sudo chmod +x main.js`);
        shell.echo('(2/7) Linking dependencies...');
        shell.exec(`npm link`);

        // check if /etc/hosts exists
        shell.echo('(3/7) Checking if the host file exists...')
        if (!fs.existsSync(config.pathToHostsFile)) {
          shell.echo('Error: /etc/hosts does not exist');
          shell.exit(1);
        }

        // check if /etc/hosts is writable
        shell.echo('(4/7) Get access to write into /etc/hosts...')
        if (shell.exec(`sudo chmod 777 ${config.pathToHostsFile}`).code !== 0) {
          shell.echo('Error: Failed to get access to write into /etc/hosts');
          shell.exit(1);
        }

        // check if /etc/hosts contains locallyCLI configurations
        shell.echo('(5/7) Checking if /etc/hosts contains locallyCLI configurations...')
        if (fs.readFileSync(config.pathToHostsFile).includes('## START: locallyCLI configurations ##')) {
          shell.echo('locallyCLI configurations already exist in /etc/hosts');
          shell.exit(1);
        } else {
          // Write into /etc/hosts
          shell.echo('(6/7) Writing locallyCLI configurations into /etc/hosts...');
          fs.appendFileSync(config.pathToHostsFile, '\n\n');
          fs.appendFileSync(config.pathToHostsFile, '## START: locallyCLI configurations ##\n');
          fs.appendFileSync(config.pathToHostsFile, '## END: locallyCLI configurations ##\n');
        }

        // Reset permissions for /etc/hosts to 644
        shell.echo('(7/7) Disabling access to write into /etc/hosts...')
        _disableHostsWriteAccess();

        // Provide feedback and instructions
        shell.echo('\n');
        shell.echo('====================================');
        shell.echo('locallyCLI successfully initialized');
        shell.echo('====================================');
        shell.echo('You can now use the following commands: \n');
        shell.echo('🧰 locally add [domain] - Add a new .local domain with https, excluding .local. To add a subdomain, simply add it to the domain (e.g. subdomain.domain) \n');
        shell.echo('🧰 locally rm [domain] - Remove a .local domain / subdomain installed by locallyCLI \n');
        shell.echo('📜 locally list - List all domains installed by locallyCLI and the status of the self-signed certificate \n');

        shell.echo('✅ Setup complete. \n')
        shell.exit(0);
      } else {
        shell.echo('Permission denied. Script stopped.');
        shell.exit(0);
      }
    });
  });

/**
 * @function pnpm locally debug-hosts
 * @description Open the /etc/hosts file
 * @returns {void}
 */
program
  .command('debug-hosts')
  .description('Open the /etc/hosts file')
  .action(() => {
    shell.exec(`open ${config.pathToHostsFile}`);
    shell.exit(0);
  });

/**
 * @function pnpm locally list
 * @description List all domains installed by locallyCLI and the status of the self-signed certificate
 * @returns {void}
 * @example pnpm locally list
 */
program
  .command('list')
  .description('List all domains installed by locallyCLI and the status of the self-signed certificate')
  .action(() => {
    const installedDomains = _readLocallyDomains();
    
    // List all domains
    shell.echo('\n');
    shell.echo('Domains installed by locallyCLI:');
    shell.echo('================================');
    if (installedDomains.length === 0) {
      shell.echo('🈳 No domains installed by locallyCLI');
    } else {
    installedDomains.forEach(line => {
      if (line.includes('.local')) {
        shell.echo(line);
      }
    })};
    shell.echo('\n');
});

/**
 * @function locally add [domain]
 * @description Add a new .local domain with https (excl. .local)
 * @param {string} domain - The domain to add
 * @returns {void}
 * @example pnpm locally add mydomain
 * @example pnpm locally add mysubdomain.mydomain
 */
program
  .command('add <domain>')
  .description('Add a new .local domain with https (excl. .local). Should be run at the root dir of a project since certs generated are stored in _localcerts directory at the appRoot.')
  .action((domain) => {

    // Confirm with the user if they are at the root directory of their project
    let currentDir = shell.exec('pwd', {silent: true}).stdout.trim();
    inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: `\n Are you at the root directory of your project? (y/n) \n ${currentDir}`,
      }
    ]).then(answers => {
      if (!answers.proceed) {
        shell.echo('Please navigate to the root directory of your project, then run "locally add [domain]".');
        shell.echo('Script stopped.');
        shell.exit(0);
      } else {
        // Check if locally init has been run
    // if not, then prompt user and ask if they want to run it
    if (!fs.readFileSync(config.pathToHostsFile).includes('## START: locallyCLI configurations ##')) {
      inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'locallyCLI has not been initialized. Would you like to run `locally init` now? (y/n)',
        }
      ]).then(answers => {
        if (answers.proceed) {
          shell.exec('node locally init');
        } else {
          shell.echo('Initialization of locallyCLI is required in order to set up https domains using locallyCLI.'); 
          shell.echo('Script stopped.');
          shell.exit(0);
        }
      });
    }

    // Check if the domain is already in /etc/hosts within the locallyCLI configurations
    let domainExists = _checkIfDomainExists(domain);

    
    if (domainExists) {
      shell.echo('\n');
      shell.echo(`Error: ${domain}.local already exists in /etc/hosts`);
      shell.echo(`=====================================================`)
      shell.echo(`Try starting the dev server and visit https://${domain}.local to see if it works. If it doesn't, try running 'pnpm locally rm ${domain}' and then 'pnpm locally add ${domain}' again.`);
      shell.echo(`If the issue persists, please raise an issue on the locallyCLI GitHub repository.`);
      shell.echo(`Script stopped.`)
      shell.echo('\n');
      shell.exit(1);
    } else {
      
      // Enable write access to /etc/hosts
      shell.echo('(1/4) Getting access to write into /etc/hosts...')
      _enableHostsWriteAccess();
      
      // Add domain to /etc/hosts in between the locallyCLI configurations
      shell.echo(`(2/4) Adding ${domain}.local ...`);
      domain = domain + '.local';

      // Generate the certificate using mkcert in the current directory, then move it to the localcerts directory in the project root
      shell.echo(`(3/4) Generating certificate for ${domain}...`);
      shell.exec(`mkdir _localcerts`);
      // generate cert in localcert directory
      shell.exec(`sudo mkcert -install ${domain}`);
      shell.exec(`mv ${domain}.pem _localcerts/${domain}.pem`);
      shell.exec(`mv ${domain}-key.pem _localcerts/${domain}-key.pem`);

      // ensure that certs are readable by all
      shell.exec(`sudo chmod 644 _localcerts/${domain}.pem`);
      shell.exec(`sudo chmod 644 _localcerts/${domain}-key.pem`);
      
      // get directory path for where the cert is stored
      let certDir = shell.exec('pwd', {silent: true}).stdout.trim() + '/' + config.defaultCertDir;

      // Add domain to /etc/hosts
      _insertBeforeEnd(`#--- ${domain}: certdir(${certDir}) ---#`);
      _insertBeforeEnd(`::1 ${domain}`);
      _insertBeforeEnd(`127.0.0.1 ${domain}`);

      // read /etc/hosts to check if domain has been added
      let updatedDomainExists = _checkIfDomainExists(domain);

      if (!updatedDomainExists) {
        shell.echo('\n');
        shell.echo(`Error: ${domain}.local could not be added to /etc/hosts`);
        shell.echo(`=====================================================`)
        shell.echo(`Try running 'pnpm locally add ${domain}' again.`);
        shell.echo(`You might want to check if /etc/hosts is writable.`)
        shell.echo(`If the issue persists, please raise an issue on the locallyCLI GitHub repository.`);
        shell.echo(`Script stopped.`)
        shell.echo('\n');
        shell.exit(1);
      } else {
        // Disable write access to /etc/hosts
        shell.echo('(4/4) Disabling access to write into /etc/hosts...')
        _disableHostsWriteAccess();

        // Provide feedback
        shell.echo('\n');
        shell.echo(`=====================================================`)
        shell.echo(`[SUCCESS] Domain ${domain} has been installed.`)
        shell.echo(`=====================================================`)
        shell.echo(`Try starting the dev server and visit https://${domain} to see if it works.`)
        shell.echo(`If it doesn't, try running 'locally rm ${domain}' and then 'locally add ${domain}' again.`)
        shell.echo(`If the issue persists, please raise an issue on the locallyCLI GitHub repository.`)
        shell.echo(`Script stopped.`)
        shell.echo('\n');
        shell.exit(0);
      }
    }
      }
    });
  });

/**
 * @function locally rm [domain]
 * @description Remove a .local domain / subdomain installed by locallyCLI
 * @param {string} domain - The domain to remove
 * @returns {void}
 * @example pnpm locally rm mydomain
 * @example pnpm locally rm mysubdomain.mydomain
 */
program
  .command('rm <domain>')
  .description('Remove a .local domain / subdomain installed by locallyCLI')
  .action((domain) => {

    // check if currently at project root and contains _localcerts directory
    if (!fs.existsSync(config.defaultCertDir)) {
      shell.echo('Error: _localcerts directory does not exist. This command should be run at the root directory of a project that has been set up with locallyCLI.');
      shell.echo('Please navigate to your project root, then run "node locally rm [domain]".');
      shell.echo('Script stopped.');
      shell.exit(1);
    }

    // Check if the domain exists in /etc/hosts within the locallyCLI configurations
    let domainExists = _checkIfDomainExists(domain);

    if (!domainExists) {
      shell.echo('\n');
      shell.echo(`Error: ${domain}.local does not exist in /etc/hosts`);
      shell.echo(`=====================================================`)
      shell.echo(`Did you enter the correct domain name to remove?`);
      shell.echo(`If you are unsure, run 'pnpm locally list' to see all domains installed by locallyCLI.`);
      shell.echo(`Script stopped.`)
      shell.echo('\n');
      shell.exit(1);
    } else {

      // Enable write access to /etc/hosts
      shell.echo('(1/4) Getting access to write into /etc/hosts...')
      _enableHostsWriteAccess();

      // Remove domain from /etc/hosts
      shell.echo(`(2/4) Removing ${domain}.local ...`);
      domain = domain + '.local';

      // Remove domain from /etc/hosts
      const installedDomains = _readLocallyDomains();
      _deleteLineWithText(`#--- ${domain}: certdir`);
      _deleteLineWithText(`::1 ${domain}`);
      _deleteLineWithText(`127.0.0.1 ${domain}`);

      // Remove the certificate
      shell.echo(`(3/4) Removing certificate for ${domain} from projectRoot...`);
      shell.exec(`sudo mkcert -uninstall ${domain}`);
      shell.exec(`sudo rm ${config.defaultCertDir}/${domain}.pem ${config.defaultCertDir}/${domain}-key.pem`);

      // if _localcerts has no files in it, then remove it as well
      if (fs.readdirSync(config.defaultCertDir).length === 0) {
        shell.echo(`(4/4) Removing _localcerts directory...`);
        shell.exec(`rmdir _localcerts`);
      }

      // Check if domain has been removed
      let updatedDomainExists = _checkIfDomainExists(domain);

      if (updatedDomainExists) {
        shell.echo('\n');
        shell.echo(`Error: ${domain}.local could not be removed from /etc/hosts`);
        shell.echo(`=====================================================`)
        shell.echo(`Try running 'locally rm ${domain}' again.`);
        shell.echo(`You might want to check if /etc/hosts is writable.`)
        shell.echo(`If the issue persists, please raise an issue on the locallyCLI GitHub repository.`);
        shell.echo(`Script stopped.`)
        shell.echo('\n');
        shell.exit(1);
      } else {
        // Disable write access to /etc/hosts
        shell.echo('(4/4) Disabling access to write into /etc/hosts...')
        _disableHostsWriteAccess();

        // Provide feedback that the domain has been removed
        shell.echo('\n');
        shell.echo(`=====================================================`)
        shell.echo(`Domain ${domain} has been successfully removed.`)
        shell.echo(`=====================================================`)
        shell.echo(`Script stopped.`)
        shell.echo('\n');
        shell.exit(0);
      }
    }
  }
);

/**
 * @function _readLocallyDomains (internal)
 * @description Read all domains installed by locallyCLI from /etc/hosts
 * @returns {string[]} - An array of all domains installed by locallyCLI
 */
const _readLocallyDomains = () => {
  let lines = fs.readFileSync(config.pathToHostsFile, 'utf-8').split('\n');
  let startLineIndex = lines.findIndex(line => line === '## START: locallyCLI configurations ##');
  let endLineIndex = lines.findIndex(line => line === '## END: locallyCLI configurations ##');
  let locallyLines = lines.slice(startLineIndex + 1, endLineIndex);
  return locallyLines;
}

/**
 * @function _checkIfDomainExists (internal)
 * @description Check if a domain exists in /etc/hosts within the locallyCLI configurations
 * @param {*} domain 
 * @returns 
 */
const _checkIfDomainExists = (domain) => {
  const installedDomains = _readLocallyDomains();
  return installedDomains.some(line => line.includes(domain));
}

/**
 * @function insertBeforeEnd (internal) insert lines before ## END: locallyCLI configurations ##
 * @description Insert a line before the line ## END: locallyCLI configurations ##
 */ 

const _insertBeforeEnd = (text) => {
  let path = config.pathToHostsFile
  let lines = fs.readFileSync(path, 'utf-8').split('\n');
  let endLineIndex = lines.findIndex(line => line === '## END: locallyCLI configurations ##');
  lines.splice(endLineIndex, 0, text);
  fs.writeFileSync(path, lines.join('\n'));
}
/**
 * @function _deleteLineWithText (internal)
 * @description Delete a line from /etc/hosts that contains a specific text
 * @param {*} text 
 */
const _deleteLineWithText = (text) => {
  let path = config.pathToHostsFile
  let lines = fs.readFileSync
  (path, 'utf-8').split('\n');
  let updatedLines = lines.filter(line => !line.includes(text));
  fs.writeFileSync(path, updatedLines.join('\n'));
}

/**
 * @function _enableHostsWriteAccess (internal)
 * @description Set permissions to write into /etc/hosts
 * @returns {void}
 */
const _enableHostsWriteAccess = () => {
  // set permissions to write into /etc/hosts
  shell.echo('Getting access to write into /etc/hosts...')
  shell.echo('Sudo permission is required, please enter your password.');
  if (shell.exec('sudo chmod 777 /etc/hosts').code !== 0) {
    shell.echo('Error: Failed to get access to write into /etc/hosts');
    shell.exit(1);
  }
  shell.echo('✅ Access granted')
}

/**
 * @function _disableHostsWriteAccess (internal)
 * @description Reset permissions for /etc/hosts to 644 after writing
 * @returns {void}
 */
const _disableHostsWriteAccess = () => {
  // reset permissions for /etc/hosts to 644
  shell.echo('Disabling access to write into /etc/hosts...')
  if (shell.exec('sudo chmod 644 /etc/hosts').code !== 0) {
    shell.echo('Error: Failed to disable access to write into /etc/hosts');
    shell.exit(1);
  }
  shell.echo('✅ Done')
}

program.parse(process.argv);