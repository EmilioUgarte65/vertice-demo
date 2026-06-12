/**
 * CROIVA - Application State
 */

export const State = {
  currentScreen: null,
  currentProjectId: null,
  currentProject: null,
  currentPartidaData: null,
  currentPaymentId: null,
  currentPaymentData: null,
  currentQuotePartidasId: null,
  currentQuotePartidasDisplayId: null,
  currentSolicitudesFilter: 'PENDING',
  uploadedFiles: [],
  rejectedFilesCount: 0,
  paymentIdempotencyKey: null,
  allProjects: [],
  allUsers: [],
  allPayments: [],
  systemOpen: null,

  setCurrentProject(p) {
    this.currentProject = p;
    this.currentProjectId = p ? p.id : null;
  },

  setAllProjects(projects) {
    this.allProjects = projects;
  }
};
