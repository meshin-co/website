const USAGE_EXIT_CODE = 2;
export const CREDENTIAL_EXIT_CODE = 3;
export const REQUEST_TIMEOUT_MS = 30_000;
export const DETAIL_LIMIT = 300;

export const credentialError = (message) => Object.assign(new Error(message), { credential: true });

export const credentialWording = (command) => ({
  file: {
    home: () => 'site/.env',
    keyGuide: '; site/.env.example says where to get it',
    again: `Then run npm run ${command} again.`,
  },
  secret: {
    home: (name) => `the repository secret ${name}`,
    keyGuide: '',
    again: 'Then run the Write daily workflow again.',
  },
});

export const answerOf = (response) => response.json().catch(() => ({}));

function keySourceFrom(argv) {
  const at = argv.indexOf('--key-source');
  return at === -1 ? 'file' : argv[at + 1];
}

export async function auditExitCode({ label, main, argv, error = console.error }) {
  const source = keySourceFrom(argv);
  if (source !== 'file' && source !== 'secret') {
    error(`${label}: --key-source must be file or secret`);
    return USAGE_EXIT_CODE;
  }
  try {
    await main(source);
    return 0;
  } catch (failure) {
    error(`${label}: ${failure.message}`);
    return failure.credential ? CREDENTIAL_EXIT_CODE : 1;
  }
}
