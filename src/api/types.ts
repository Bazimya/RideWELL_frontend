export type PartnerStatus = 'draft' | 'applied' | 'under_review' | 'approved' | 'rejected' | 'suspended';

export interface Requirement {
  key: string;
  label: string;
  done: boolean;
}

export interface DocView {
  id: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected' | 'superseded';
  contentType: string;
  size: number;
  expiresAt: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  uploadedAt: string | null;
}

export interface StatusEvent {
  from: PartnerStatus | null;
  to: PartnerStatus;
  at: string;
  reason: string | null;
}

export interface Availability {
  acceptingTrips: boolean;
  unavailable: Array<{ from: string; to: string; note: string | null }>;
}

export interface DriverProfileView {
  id: string;
  status: PartnerStatus;
  submittedAt: string | null;
  decisionReason: string | null;
  contactPhone: string | null;
  licenceNumber: string | null;
  licenceExpiry: string | null;
  licenceCategories: string[];
  experienceYears: number | null;
  areas: string[];
  languages: string[];
  bio: string | null;
  references: Array<{ name: string; phone: string; relationship: string }>;
  availability: Availability;
  statusHistory: StatusEvent[];
}

export interface DriverView {
  profile: DriverProfileView;
  documents: DocView[];
  submissionRequirements: Requirement[];
}

export interface Payout {
  method: 'momo' | 'bank';
  momoPhone?: string | null;
  momoName?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
}

export interface OwnerView {
  profile: {
    id: string;
    status: PartnerStatus;
    submittedAt: string | null;
    decisionReason: string | null;
    contactPhone: string | null;
    type: 'individual' | 'company' | null;
    companyName: string | null;
    rdbNumber: string | null;
    tinNumber: string | null;
    representativeName: string | null;
    payout: Payout | null;
    statusHistory: StatusEvent[];
  };
  documents: DocView[];
  submissionRequirements: Requirement[];
  vehicles: Array<{ id: string; make: string; model: string; year: number; plate: string; colour: string; status: PartnerStatus }>;
}

export interface VehicleDetail {
  id: string;
  status: PartnerStatus;
  submittedAt: string | null;
  decisionReason: string | null;
  make: string;
  model: string;
  year: number;
  plate: string;
  colour: string;
  category: string;
  seats: number;
  insurer: string | null;
  insurancePolicyNumber: string | null;
  insuranceExpiry: string | null;
  proposedRates: { hourlyRwf: number | null; dailyRwf: number | null; airportTransferRwf: number | null };
  inspection: { result: 'passed' | 'failed'; notes: string | null; at: string } | null;
  availability: Availability;
  statusHistory: StatusEvent[];
}

export interface VehicleView {
  vehicle: VehicleDetail;
  documents: DocView[];
  submissionRequirements: Requirement[];
}

export interface Eligibility {
  assignable: boolean;
  reasons: string[];
}

export interface Check {
  result: 'passed' | 'failed';
  notes: string | null;
  at: string;
}

export interface Applicant {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  status: string;
}

export type AdminSubjectView =
  | (DriverView & { kind: 'driver'; applicant: Applicant | null; checks: Record<string, Check | null>; approvalRequirements: Requirement[]; eligibility: Eligibility })
  | (OwnerView & { kind: 'owner'; applicant: Applicant | null; approvalRequirements: Requirement[] })
  | (VehicleView & {
      kind: 'vehicle';
      approvalRequirements: Requirement[];
      eligibility: Eligibility;
      owner: { id: string; status: PartnerStatus; type: string | null; companyName: string | null } | null;
    });

export interface ApplicationRow {
  id: string;
  kind: 'driver' | 'owner' | 'vehicle';
  status: PartnerStatus;
  submittedAt: string | null;
  applicant: { id: string; name: string | null; phone: string | null; email: string | null } | null;
  summary: string;
}

// ---------------------------------------------------------------------------
// Bookings (Phase 4)
// ---------------------------------------------------------------------------

export type BookingStatus = 'requested' | 'quoted' | 'paid' | 'assigned' | 'in_progress' | 'completed' | 'expired' | 'cancelled' | 'refunded';
export type Service = 'driver_on_demand' | 'chauffeur';

export interface Place {
  address: string;
  notes: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface BookingCommon {
  id: string;
  ref: string;
  service: Service;
  airport: { direction: 'from_airport' | 'to_airport'; flightNumber: string | null } | null;
  startAt: string;
  endAt: string;
  passengers: number;
  status: BookingStatus;
  startedAt: string | null;
  endedAt: string | null;
}

export interface CustomerVehicle {
  make: string | null;
  model: string | null;
  plate: string | null;
  colour?: string | null;
  transmission?: string | null;
}

export interface VehicleSummary {
  id: string;
  make: string;
  model: string;
  colour: string;
  plate: string;
  seats: number;
  category: string;
}

export interface CustomerBooking extends BookingCommon {
  pickup: Place;
  dropoff: Place | null;
  notes: string | null;
  customerVehicle: CustomerVehicle | null;
  history: Array<{ to: BookingStatus; at: string; actorType: string; reason: string | null }>;
  quote: { amountRwf: number; validUntil: string; note: string | null } | null;
  canPay: boolean;
  payment: { amountRwf: number; verifiedAt: string; isDevelopment: boolean } | null;
  driver: { firstName: string; hasPhoto: boolean } | null;
  vehicle: VehicleSummary | null;
  tripPin: string | null;
  cancellable: boolean;
  cancellationPreview: { hoursBeforePickup: number; refundBps: number; refundDueRwf: number } | null;
  cancellation: { at: string; reason: string | null; refundDueRwf: number | null } | null;
  refunds: Array<{ amountRwf: number; status: 'requested' | 'completed' | 'rejected' | 'failed'; completedAt: string | null; isDevelopment: boolean }>;
  canReportSafety: boolean;
  hasOpenSafetyReport: boolean;
  rating: Rating | null;
  canRate: boolean;
}

export interface Rating {
  stars: number;
  comment: string | null;
  createdAt: string;
}

export interface BookingListRow extends BookingCommon {
  pickup: string;
  dropoff: string | null;
  quoteAmountRwf: number | null;
  needsAttention: boolean;
  attentionReason: string | null;
}

export interface DriverTrip extends BookingCommon {
  pickup: Place;
  dropoff: Place | null;
  notes: string | null;
  customerVehicle: CustomerVehicle | null;
  vehicle: VehicleSummary | null;
  customer: { firstName: string; phone: string | null };
  offer: { deadline: string | null } | null;
  accepted: boolean;
  waitingForVehicleOwner: boolean;
  navigation: { pickup: string; dropoff: string | null } | null;
  pinLocked: boolean;
  canReportSafety: boolean;
  isMine: boolean;
}

export interface OwnerTrip extends BookingCommon {
  vehicle: VehicleSummary | null;
  offer: { deadline: string | null } | null;
  accepted: boolean;
}

export interface StaffBooking extends BookingCommon {
  pickup: Place;
  dropoff: Place | null;
  notes: string | null;
  channel: 'web' | 'phone';
  customerVehicle: CustomerVehicle | null;
  customer: { id: string; name: string; phone: string | null; email: string | null } | null;
  driver: { id: string; name: string; phone: string | null } | null;
  vehicle: VehicleSummary | null;
  quote: { amountRwf: number; validUntil: string; note: string | null; sentAt: string } | null;
  commissionSnapshot: { configVersion: number; isPlaceholder: boolean; split: Record<string, number>; sharesBps: Record<string, number> } | null;
  acceptance: { deadline: string | null; driverAcceptedAt: string | null; vehicleAcceptedAt: string | null } | null;
  declines: Array<{ role: string; at: string; reason: string | null }>;
  attention: { needsReassignment: boolean; reason: string | null; notStartedAlertAt: string | null; acceptanceTimeoutAt: string | null };
  pinLocked: boolean;
  pinFailedAttempts: number;
  cancellation: { at: string; reason: string | null; refundDueRwf: number | null; actorType: string } | null;
  payments: Array<{ id: string; provider: string; amountRwf: number; status: string; isDevelopment: boolean; verifiedAt: string | null; createdAt: string }>;
  history: Array<{ from: string | null; to: string; at: string; actorType: string; reason: string | null }>;
  hasOpenSafetyReport: boolean;
  rating: Rating | null;
}

export interface Candidate {
  id: string;
  label: string;
  detail: string;
  available: boolean;
  reasons: string[];
}

export interface OpsAlert {
  id: string;
  type: string;
  severity: 'high' | 'normal';
  bookingId: string | null;
  bookingRef: string | null;
  message: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Dashboards, notifications, support (Phase 7)
// ---------------------------------------------------------------------------

export interface InboxItem {
  id: string;
  key: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface Inbox {
  notifications: InboxItem[];
  unread: number;
  nextBefore: string | null;
}

export type SupportCategory = 'booking' | 'payment' | 'account' | 'partner' | 'other';

export interface SupportRequest {
  id: string;
  ref: string;
  bookingId: string | null;
  bookingRef: string | null;
  category: SupportCategory;
  message: string;
  status: 'open' | 'resolved';
  reply: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export type EarningTotals = Record<'pending' | 'held' | 'payable' | 'paid' | 'disputed' | 'reversed', number>;
export interface TripOffer {
  id: string;
  ref: string;
  startAt: string;
  deadline: string | null;
}

export interface MyDashboard {
  customer: {
    upcoming: BookingListRow[];
    actions: Array<{ kind: 'pay_quote' | 'rate_driver'; bookingId: string; ref: string; until: string | null }>;
    totals: { bookings: number; completed: number; active: number };
    openSupport: number;
  };
  driver?: {
    profileStatus: PartnerStatus;
    acceptingTrips: boolean;
    onSafetyHold: boolean;
    offers: TripOffer[];
    next: { id: string; ref: string; status: BookingStatus; startAt: string; service: Service } | null;
    upcomingCount: number;
    completedThisMonth: number;
    completedAllTime: number;
    earnings: EarningTotals;
    rating: { average: number | null; count: number };
    expiringDocuments: number;
  };
  owner?: {
    profileStatus: PartnerStatus;
    vehicles: Array<{ id: string; label: string; status: PartnerStatus }>;
    offers: TripOffer[];
    inProgress: number;
    upcomingCount: number;
    completedAllTime: number;
    earnings: EarningTotals;
    expiringDocuments: number;
  };
}

export interface StaffDashboard {
  generatedAt: string;
  bookings?: {
    awaitingQuote: number;
    awaitingPayment: number;
    awaitingAcceptance: number;
    needsReassignment: number;
    inProgress: number;
    today: BookingListRow[];
    openAlerts: number;
    recentAlerts: OpsAlert[];
  };
  safety?: { openReports: number };
  support?: { open: number; oldestOpenAt: string | null };
  partners?: { applications: { drivers: number; owners: number; vehicles: number }; documentsToReview: number; documentsExpiring30Days: number };
  finance?: { refundsAwaitingApproval: number; payableRwf: number; payablePartners: number; developmentPayments: number };
  notifications?: { providers: { sms: string; email: string; isDevelopment: boolean }; failedLast7Days: number; pending: number };
}

export interface OperationsReport {
  range: { from: string; to: string };
  requests: { total: number; byService: Record<string, number>; byChannel: Record<string, number>; byCurrentStatus: Record<string, number> };
  funnel: { requested: number; quoted: number; paid: number; assigned: number; completed: number; cancelled: number; expired: number };
  medianMinutes: { requestToQuote: number | null; paymentToAssigned: number | null };
  cancellationsBy: Record<string, number>;
  trips: { completed: number; byService: Record<string, number>; hours: number };
  alerts: Record<string, number>;
  safetyReports: number;
  ratings: { count: number; average: number | null; low: number };
  drivers: Array<{ id: string; name: string; completed: number; hours: number; declines: number; ratings: number; averageRating: number | null }>;
  series: Array<{ date: string; requests: number; completed: number }>;
}

export interface MoneyTotals {
  customerPaymentsRwf: number;
  refundsRwf: number;
  providerFeesRwf: number;
  platformCommissionRwf: number;
  platformAdjustmentsRwf: number;
  driverEarningsRwf: number;
  vehicleOwnerEarningsRwf: number;
  partnerAdjustmentsRwf: number;
  payoutsRwf: number;
  platformNetRwf: number;
}

export interface FinanceReport {
  range: { from: string; to: string };
  real: MoneyTotals;
  development: MoneyTotals;
  developmentBookings: number;
  byService: Record<string, MoneyTotals>;
  owedToPartnersNow: Record<'pending' | 'held' | 'payable' | 'disputed', number>;
  entries: number;
  series: Array<{ date: string; paymentsRwf: number; refundsRwf: number; platformNetRwf: number }>;
}

export interface DeliveryRow {
  id: string;
  userId: string;
  key: string;
  title: string;
  body: string;
  channel: 'sms' | 'email' | 'none';
  to: string | null;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  lastError: string | null;
  provider: string | null;
  providerMessageId: string | null;
  resendable: boolean;
  createdAt: string;
  sentAt: string | null;
}
