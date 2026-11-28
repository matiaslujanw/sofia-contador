async function unavailable(): Promise<never> {
  throw new Error("Esta edición contiene solo la demostración.");
}

export {
  unavailable as signOut,
  unavailable as confirmWorkspaceImport,
  unavailable as downloadWorkspaceDocument,
  unavailable as listWorkspaceDocuments,
  unavailable as mutateWorkspace,
  unavailable as uploadWorkspaceDocument,
};

export const previewWorkspaceCompanyDeletion = unavailable;
