export interface TicketType { id: number; name: string; price: number; quantity: number; remaining: number }
export type ConcertStatus = "AVAILABLE" | "ALMOST_FULL" | "SOLD_OUT" | "FINISHED";
export interface Concert {
  id: number; name: string; description: string; venue: string; date: string;
  total_seats: number; poster_url: string | null; min_price: number | null;
  remaining: number; status: ConcertStatus; ticket_types: TicketType[];
}
export interface TicketInfo { number: string | null; status: "VALID" | "USED"; used_at: string | null }
export interface Order {
  id: number; reference: string; concert_id: number; concert_name: string; concert_date: string;
  ticket_type_name: string; unit_price: number; quantity: number; total_amount: number;
  customer_name: string; customer_email: string; pay_mode: "PAY_NOW" | "RESERVE";
  status: "PENDING" | "ACCEPTED" | "REJECTED"; payment_status: "UNPAID" | "PROOF_SUBMITTED" | "PAID";
  has_proof: boolean; reject_reason: string | null; created_at: string; tickets: TicketInfo[];
}
export interface Delivery {
  order: Order; tickets: { number: string; qr_image: string }[];
  email_status: "queued" | "smtp_not_configured";
}
export interface DashRow {
  id: number; name: string; date: string; total_seats: number; ordered: number; paid: number;
  unpaid: number; remaining: number; revenue_paid: number; revenue_pending: number;
}
export interface Dashboard {
  totals: Omit<DashRow, "id" | "name" | "date"> & {
    orders_pending: number; orders_accepted: number; orders_rejected: number;
    tickets_generated: number; tickets_used: number;
  };
  per_concert: DashRow[];
}
export interface ScanResult {
  result: "VALID" | "ALREADY_USED" | "NOT_PAID" | "RESERVATION" | "INVALID"; message: string;
  ticket: { number: string; customer_name: string; ticket_type: string; concert_name: string;
    concert_date: string; payment_status: string; used_at: string | null; unit_price?: number } | null;
}

export interface ClientTicket {
  number: string;
  qr_image: string;
}

export interface ClientOrder {
  id: number;
  reference: string;
  concert_name: string;
  concert_venue: string;
  concert_date: string;
  ticket_type_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  payment_status: "UNPAID" | "PROOF_SUBMITTED" | "PAID";
  pay_mode: "PAY_NOW" | "RESERVE";
  reject_reason: string | null;
  created_at: string;
  tickets: ClientTicket[];
  email_available: boolean;
}

export interface SupportMessage {
  id: number;
  customer_name?: string;
  customer_email?: string;
  subject: string;
  message: string;
  order_reference: string | null;
  admin_reply: string | null;
  replied_at: string | null;
  is_resolved: boolean;
  created_at: string;
}

export interface ChatMessageItem {
  id: number;
  customer_email: string;
  customer_name: string;
  sender: "CLIENT" | "ADMIN";
  message: string;
  created_at: string;
}

export interface ChatConversation {
  customer_email: string;
  customer_name: string;
  last_message: string;
  last_sender: "CLIENT" | "ADMIN";
  last_at: string;
}


