import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CreditCard, Star, Plus, LogOut,
  TrendingUp, Shield, Clock, CheckCircle, ChevronRight, Menu, X,
  Car, Sparkles, ArrowUp, Gift
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Appointment, Payment, Subscription } from '@/lib/supabase';
import { money, calcSavings, ADD_ONS, VEHICLE_SIZES, MEMBERSHIPS, prettyLabel, firstWord } from '@/lib/data';
import { packageForSelf, type DetailFamily, type DetailSelf } from '@/lib/detailCatalog';
import { DEFAULT_TRAVEL_BUFFER_MINUTES } from '@/lib/driveTime';
import { clockMinutesInZone, minuteWindowsOverlap, occupyMinutes, SLOT_MINUTES, todayYmdInZone, zonedDateTimeIso } from '@/lib/scheduling';
import DetailSelfPicker from '@/components/DetailSelfPicker';
import PortalPageHead from '@/components/PortalPageHead';
import { sendCommunication } from '@/lib/communications';
import EmployeeAvatar from '@/components/EmployeeAvatar';
import WorkspaceGate from '@/components/WorkspaceGate';
import { BRAND_LOGO } from '@/lib/brand';
import { getProfile } from '@/lib/auth';
import {
  applyCustomerReferral,
  referralContactFromUser,
  spendAccountCredit,
  stashPendingReferral,
  takePendingReferral,
  REFERRAL_CREDIT,
} from '@/lib/referrals';

type Tab = 'dashboard' | 'appointments' | 'subscription' | 'billing';

function StatusBadge({ status }: { status?: string | null }) {
  const colors: Record<string, string> = {
    pending: 'badge-yellow',
    confirmed: 'badge-blue',
    in_progress: 'badge-purple',
    completed: 'badge-green',
    cancelled: 'badge-red',
    active: 'badge-green',
    paused: 'badge-yellow',
  };
  const safe = status || 'unknown';
  return <span className={`status-badge ${colors[safe] ?? 'badge-gray'}`}>{prettyLabel(safe)}</span>;
}

function AppointmentProgress({appointment,compact=false}:{appointment:Appointment;compact?:boolean}){
  const field=String(appointment.field_status||'').toLowerCase();
  const status=String(appointment.status||'').toLowerCase();
  const stage=status==='completed'||field==='completed'||field==='finished'?4:field==='started'||status==='in_progress'?3:field==='en_route'||field==='arrived'?2:appointment.assigned_employee_id?1:0;
  const steps=['Booked','Assigned','En route','In service','Done'];
  return <div className={`customer-job-progress-v25 ${compact?'compact':''}`} aria-label={`Appointment progress: ${steps[stage]}`}><div className="customer-progress-track-v25"><i style={{width:`${stage/4*100}%`}}/></div><div className="customer-progress-steps-v25">{steps.map((label,i)=><span key={label} className={i<=stage?'done':''}><b>{i<stage?'✓':i+1}</b><small>{label}</small></span>)}</div></div>
}

function SavingsBar({ spent, savings }: { spent: number; savings: number }) {
  const total = spent + savings;
  const spentPct = total > 0 ? (spent / total) * 100 : 50;
  return (
    <div className="savings-visual">
      <div className="savings-bar">
        <div className="savings-spent" style={{ width: `${spentPct}%` }}>
          <span>Invested</span>
        </div>
        <div className="savings-saved" style={{ width: `${100 - spentPct}%` }}>
          <span>Saved</span>
        </div>
      </div>
      <div className="savings-labels">
        <div className="savings-label-item">
          <div className="swatch swatch-spent" />
          <div>
            <strong>{money(spent)}</strong>
            <span>Lifetime invested in care</span>
          </div>
        </div>
        <div className="savings-label-item">
          <div className="swatch swatch-saved" />
          <div>
            <strong>{money(savings)}</strong>
            <span>Estimated damage prevented</span>
          </div>
        </div>
      </div>
      <div className="savings-roi">
        <ArrowUp size={14} />
        <span>~{money(savings - spent)} net vehicle value protection</span>
      </div>
    </div>
  );
}

export default function Portal() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Booking form state
  const [showBook, setShowBook] = useState(false);
  const [bookFamily, setBookFamily] = useState<DetailFamily>('full');
  const [bookSelf, setBookSelf] = useState<DetailSelf>('signature');
  const [bookVehicle, setBookVehicle] = useState(0);
  const [bookAddOns, setBookAddOns] = useState<number[]>([]);
  const [bookNotes, setBookNotes] = useState('');
  const [bookSubmitting, setBookSubmitting] = useState(false);
  const [bookDate, setBookDate] = useState('');
const [bookTime, setBookTime] = useState('');
const [availableTimes, setAvailableTimes] = useState<string[]>([]);
const [timesLoading, setTimesLoading] = useState(false);
const [availabilityError, setAvailabilityError] = useState('');
const [dayClosed, setDayClosed] = useState(false);
  const [bookDone, setBookDone] = useState(false);
  const [lastBook, setLastBook] = useState<{ name: string; when: string; price: number; addOns: string } | null>(null);
  const [subscribeBusy, setSubscribeBusy] = useState(false);
  const [subscribeNotice, setSubscribeNotice] = useState('');
  const [accountCredit, setAccountCredit] = useState(0);
  const [referralNotice, setReferralNotice] = useState('');

  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    setAccountCredit(Number(profile?.account_credit || 0));
  }, [profile?.account_credit]);

  useEffect(() => {
    if (!user) return;
    const pending = takePendingReferral() || referralContactFromUser(user);
    if (!pending) return;
    let live = true;
    applyCustomerReferral(pending).then(async (result) => {
      if (!live) return;
      if (result.ok && !result.already) {
        setReferralNotice(result.message || `$${result.credit || REFERRAL_CREDIT} referral credit is on your account.`);
      } else if (!result.ok && result.error) {
        stashPendingReferral(pending);
        setReferralNotice(result.error);
      }
      const next = await getProfile(user.id).catch(() => null);
      if (live && next) setAccountCredit(Number(next.account_credit || 0));
    });
    return () => { live = false };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        setLoadError('');
        const [apts, pays, subs] = await Promise.all([
          supabase.from('appointments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
          supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
        ]);
        if (apts.error) throw new Error(apts.error.message);
        if (pays.error) throw new Error(pays.error.message);
        if (subs.error) throw new Error(subs.error.message);
        setAppointments((apts.data ?? []).map((a: Appointment) => ({ ...a, add_ons: Array.isArray(a.add_ons) ? a.add_ons : [] })));
        setPayments(pays.data ?? []);
        setSubscription(subs.data ?? null);
      } catch (err) {
        setLoadError(err instanceof Error && err.message ? err.message : 'Could not load your appointments.');
      } finally {
        setDataLoading(false);
      }
    })();
  }, [user]);

  const lifetimeSpend = payments.reduce((s, p) => s + p.amount, 0);
  const lifetimeSavings = calcSavings(lifetimeSpend);
  const upcomingAppointment = appointments.find(a => a.status !== 'completed' && a.status !== 'cancelled');

  const handleSignOut = async () => {
    await signOut().catch(() => {});
    navigate('/');
  };

  const loadAvailableTimes = async (date: string, family = bookFamily, self = bookSelf) => {
  setBookDate(date);
  setBookTime('');
  setAvailableTimes([]);
  setAvailabilityError('');
  setDayClosed(false);

  if (!date) return;

  setTimesLoading(true);

  try {
    const { data: dayAvailability, error: dayAvailErr } =
      await supabase
        .from('availability')
        .select('*')
        .eq('date', date)
        .maybeSingle();

    if (dayAvailErr) throw dayAvailErr;

    if (!dayAvailability || !dayAvailability.is_available) {
      setDayClosed(true);
      setAvailableTimes([]);
      return;
    }

    const { data: bookedRpc, error: bookedError } = await supabase.rpc(
      'get_booked_times',
      {
        for_date: date,
      }
    );

    if (bookedError) throw bookedError;

    const bookedRows: Array<Record<string, unknown>> = Array.isArray(bookedRpc) ? bookedRpc as Array<Record<string, unknown>> : [];

    const occupied = bookedRows
      .map((item) => {
        const iso = String(item.scheduled_at || item.start || '');
        if (!iso) return null;
        return { start: clockMinutesInZone(iso), minutes: occupyMinutes(item) };
      })
      .filter((row): row is { start: number; minutes: number } => Boolean(row));

    const needMinutes = (packageForSelf(family, self).minutes || 120) + DEFAULT_TRAVEL_BUFFER_MINUTES;
    const slots: string[] = [];
    const startValue=dayAvailability.start_time||'09:00';
    const endValue=dayAvailability.end_time||'17:00';
    const slotMinutes=Math.max(SLOT_MINUTES,Number(dayAvailability.slot_minutes||60));
    const [startHour, startMinute] = startValue.split(':').map(Number);
    const [endHour, endMinute] = endValue.split(':').map(Number);
    let current = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    while (current + needMinutes <= end) {
      const hours = Math.floor(current / 60);
      const minutes = current % 60;
      const value =
        `${String(hours).padStart(2, '0')}:` +
        `${String(minutes).padStart(2, '0')}`;
      const blocked = occupied.some((job) => minuteWindowsOverlap(current, needMinutes, job.start, job.minutes));
      if (!blocked) slots.push(value);
      current += slotMinutes;
    }

    setAvailableTimes(slots);
  } catch (error) {
    setAvailabilityError(error instanceof Error && error.message ? error.message : 'Could not load open times.');
    setAvailableTimes([]);
  } finally {
    setTimesLoading(false);
  }
};
  
  const bookedPkg = packageForSelf(bookFamily, bookSelf);

  const openBook = () => {
    setBookDone(false);
    setBookSubmitting(false);
    setShowBook(true);
  };

  const refreshPortal = async () => {
    if (!user) return;
    try {
      setLoadError('');
      const [apts, pays, subs] = await Promise.all([
        supabase.from('appointments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      ]);
      if (apts.error) throw new Error(apts.error.message);
      if (pays.error) throw new Error(pays.error.message);
      if (subs.error) throw new Error(subs.error.message);
      setAppointments((apts.data ?? []).map((a: Appointment) => ({ ...a, add_ons: Array.isArray(a.add_ons) ? a.add_ons : [] })));
      setPayments(pays.data ?? []);
      setSubscription(subs.data ?? null);
    } catch (err) {
      setLoadError(err instanceof Error && err.message ? err.message : 'Could not refresh your appointments.');
    }
  };

  const handleBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!bookDate || !bookTime) {
      alert('Please choose an appointment date and time.');
      return;
    }

    setBookSubmitting(true);

    try {
      const gross =
        bookedPkg.price +
        VEHICLE_SIZES[bookVehicle].extra +
        bookAddOns.reduce((sum, i) => sum + ADD_ONS[i][1], 0);

      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          user_id: user.id,
          customer_name: profile?.full_name ?? null,
          customer_email: user.email ?? null,
          customer_phone: profile?.phone ?? null,
          service_name: bookedPkg.name,
          scheduled_at: zonedDateTimeIso(bookDate, bookTime),
          package_name: bookedPkg.name,
          add_ons: bookAddOns.map(i => ADD_ONS[i][0]),
          vehicle_info: profile?.vehicle_info ?? '',
          estimated_duration_minutes: bookedPkg.minutes || 120,
          travel_buffer_minutes: DEFAULT_TRAVEL_BUFFER_MINUTES,
          price: gross,
          notes: bookNotes,
          status: 'pending',
          source_channel: 'portal',
          dispatch_status: 'unassigned',
          field_status: 'scheduled',
        })
        .select()
        .single();

      if (appointmentError) throw appointmentError;
      if (!appointment?.id) throw new Error('Appointment was not created.');

      const { spent, remaining } = await spendAccountCredit(gross);
      const price = Math.max(0, gross - spent);
      if (spent) {
        setAccountCredit(remaining);
        const creditNote = `Referral credit applied: ${money(spent)} (was ${money(gross)}).`;
        const notes = [bookNotes.trim(), creditNote].filter(Boolean).join('\n');
        await supabase.from('appointments').update({ price, notes }).eq('id', appointment.id);
        appointment.price = price;
        appointment.notes = notes;
      }

      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          user_id: user.id,
          appointment_id: appointment.id,
          amount: price,
          status: 'pending',
          description: spent ? `${bookedPkg.name} · ${money(spent)} referral credit` : bookedPkg.name,
        });

      if (paymentError) console.warn('Pending payment row failed', paymentError);

      if (user.email) {
        const when = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null;
        sendCommunication('booking_received', {
          appointment_id: appointment.id,
          recipient_email: user.email,
          variables: {
            customer_name: profile?.full_name || 'Customer',
            service_name: bookedPkg.name,
            appointment_date: when ? when.toLocaleDateString('en-US') : bookDate,
            appointment_time: when
              ? when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
              : bookTime,
          },
        }).catch(console.warn);
      }

      await refreshPortal();
      const when = appointment.scheduled_at ? new Date(appointment.scheduled_at) : new Date(`${bookDate}T${bookTime}:00`);
      setLastBook({
        name: bookedPkg.name,
        when: when.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
        price,
        addOns: bookAddOns.map(i => ADD_ONS[i][0]).join(', '),
      });
      setBookDone(true);
    } catch (error) {
      console.error('Booking error:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Unable to request this appointment. Please try again.'
      );
    } finally {
      setBookSubmitting(false);
    }
  };

  const handleSubscribe = async (plan: typeof MEMBERSHIPS[0]) => {
    if (!user || subscribeBusy) return;
    setSubscribeBusy(true);
    setSubscribeNotice('');

    try {
      const nextDate = new Date();
      nextDate.setMonth(nextDate.getMonth() + 1);

      const { data: newSubscription, error } = await supabase
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_name: plan.name,
          plan_price: plan.price,
          status: 'pending',
          next_detail_date: nextDate.toISOString().split('T')[0],
          billing_cycle_start: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (error) throw error;
      if (!newSubscription?.id) throw new Error('Membership request was not created.');

      setSubscribeNotice(`${plan.name} membership requested. We'll be in touch to confirm billing.`);
    } catch (error) {
      console.error('Membership request error:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Unable to request this membership.'
      );
    } finally {
      setSubscribeBusy(false);
    }
  };

  const navItems: { id: Tab; label: string; Icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'appointments', label: 'My Appointments', Icon: Calendar },
    { id: 'subscription', label: 'Membership', Icon: Star },
    { id: 'billing', label: 'Billing & Savings', Icon: CreditCard },
  ];

  if (loading) {
    return <WorkspaceGate busy title="Opening customer portal" body="Loading your appointments and membership." />;
  }
  if (!user) {
    return <WorkspaceGate title="Sign in to continue" body="Appointments, membership, and billing are behind your North Splash login." homeHref="/login" homeLabel="Sign in" />;
  }
  if (dataLoading) {
    return <WorkspaceGate busy title="Loading your visits" body="Appointments, membership, and billing for this vehicle." />;
  }

  const firstName = firstWord(profile?.full_name || '', 'there');

  return (
    <div className="portal-layout nsos-cream customer-os">
      <a className="skip-to-workspace" href="#portal-workspace">Skip to workspace</a>
      {/* Sidebar */}
      <aside className={`portal-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <img className="portal-brand-logo" src={BRAND_LOGO} alt="North Splash Auto Luxe" />
            <div>
              <strong>NORTH SPLASH</strong>
              <small>AUTO LUXE</small>
            </div>
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>

        <div className="sidebar-user">
          <EmployeeAvatar profileId={profile?.id} name={profile?.full_name||'Customer'} avatarUrl={profile?.avatar_url} size="md" editable className="sidebar-avatar"/>
          <div>
            <p>{profile?.full_name ?? 'Customer'}</p>
            <span>{user?.email}</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(({ id, label, Icon }) => (
            <button
              key={id}
              className={`sidebar-item ${tab === id ? 'sidebar-active' : ''}`}
              onClick={() => { setTab(id); setSidebarOpen(false); }}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link to="/" className="sidebar-item"><Car size={18} /> View Site</Link>
          <button className="sidebar-item sidebar-signout" onClick={handleSignOut}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main id="portal-workspace" className="portal-main" tabIndex={-1}>
        <div className="portal-topbar">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="topbar-title">
            <h1>{navItems.find(n => n.id === tab)?.label}</h1>
            <span>{upcomingAppointment ? upcomingAppointment.service_name : 'Book Exterior, Interior, or Full vehicle'}</span>
          </div>
          <button className="btn-primary topbar-book" onClick={openBook}>
            <Plus size={16} /> Book Service
          </button>
        </div>

        <div className="portal-content">
          {loadError && (
            <div className="d2d-house-discovery error">
              {loadError}
              <button type="button" onClick={() => void refreshPortal()}>Retry</button>
            </div>
          )}

          {/* DASHBOARD */}
          {tab === 'dashboard' && (
            <div className="dashboard-grid">
              <div className="dash-welcome">
                <div>
                  <span className="eyebrow">Your vehicle</span>
                  <h2>Welcome back, {firstName}.</h2>
                  <p>Book Exterior, Interior, or Full vehicle — Essential, Signature, or Elite — then track the visit live.</p>
                  {referralNotice && <p className="referral-banner">{referralNotice}</p>}
                </div>
                <button className="btn-primary" onClick={openBook}>
                  <Plus size={16} /> Schedule a Detail
                </button>
              </div>

              <div className="dash-stats">
                <div className="dash-stat-card">
                  <div className="dash-stat-icon"><CreditCard size={20} /></div>
                  <div>
                    <strong>{money(lifetimeSpend)}</strong>
                    <span>Lifetime Invested</span>
                  </div>
                </div>
                <div className="dash-stat-card dash-stat-accent">
                  <div className="dash-stat-icon"><Shield size={20} /></div>
                  <div>
                    <strong>{money(lifetimeSavings)}</strong>
                    <span>Est. Damage Prevented</span>
                  </div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon"><Calendar size={20} /></div>
                  <div>
                    <strong>{appointments.filter(a => a.status === 'completed').length}</strong>
                    <span>Details Completed</span>
                  </div>
                </div>
                <div className="dash-stat-card">
                  <div className="dash-stat-icon"><Star size={20} /></div>
                  <div>
                    <strong>{subscription ? subscription.plan_name : 'None'}</strong>
                    <span>Membership Plan</span>
                  </div>
                </div>
              </div>

              {accountCredit > 0 && (
                <div className="dash-card referral-credit-card">
                  <h3><Gift size={18} /> Referral credit</h3>
                  <p className="dash-card-sub">{money(accountCredit)} will come off your next booked visit. Tell a friend at signup and you both get {money(REFERRAL_CREDIT)}.</p>
                </div>
              )}

              {/* Savings Visual */}
              {lifetimeSpend > 0 && (
                <div className="dash-card dash-savings">
                  <h3><TrendingUp size={18} /> Your Vehicle Investment vs. Protection</h3>
                  <p className="dash-card-sub">
                    Every dollar spent on professional detailing prevents an estimated <strong>$3.80</strong> in long-term paint degradation, interior wear, and resale value loss.
                  </p>
                  <SavingsBar spent={lifetimeSpend} savings={lifetimeSavings} />
                </div>
              )}

              {/* Upcoming */}
              <div className="dash-card">
                <h3><Clock size={18} /> Upcoming Appointment</h3>
                {upcomingAppointment ? (
                  <div className="upcoming-apt">
                    <div className="apt-service">{upcomingAppointment.service_name}</div>
                    <StatusBadge status={upcomingAppointment.status} />
                    <div className="apt-price">{money(upcomingAppointment.price)}</div>
                    <AppointmentProgress appointment={upcomingAppointment} compact />
                    <button className="btn-outline" onClick={() => setTab('appointments')}>
                      View Details <ChevronRight size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="empty-state ns-empty">
                    <Sparkles size={32} />
                    <p>No upcoming visits. Pick Exterior, Interior, or Full — then Essential, Signature, or Elite.</p>
                    <button className="btn-primary" onClick={openBook}>Book a self</button>
                  </div>
                )}
              </div>

              {/* Membership */}
              <div className="dash-card">
                <h3><Star size={18} /> Membership Status</h3>
                {subscription ? (
                  <div className="member-status">
                    <div className="member-plan-badge">{subscription.plan_name}</div>
                    <div className="member-detail">
                      <span>Next detail</span>
                      <strong>{subscription.next_detail_date ? new Date(subscription.next_detail_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}</strong>
                    </div>
                    <div className="member-detail">
                      <span>Monthly rate</span>
                      <strong>{money(subscription.plan_price)}/mo</strong>
                    </div>
                    <button className="btn-outline" onClick={() => setTab('subscription')}>Manage <ChevronRight size={14} /></button>
                  </div>
                ) : (
                  <div className="empty-state ns-empty">
                    <Star size={32} />
                    <p>No active membership. Monthly plans keep Signature visits on the calendar.</p>
                    <button className="btn-outline" onClick={() => setTab('subscription')}>Explore Plans</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* APPOINTMENTS */}
          {tab === 'appointments' && (
            <div className="tab-content">
              <PortalPageHead
                kicker="Visits"
                title="Your appointments"
                lead={appointments.length ? `${appointments.length} service${appointments.length !== 1 ? 's' : ''} on file — live status from booked through complete.` : 'Book your first Exterior, Interior, or Full-vehicle self.'}
              >
                <button className="btn-primary" onClick={openBook}>
                  <Plus size={16} /> New Appointment
                </button>
              </PortalPageHead>

              {appointments.length === 0 ? (
                <div className="empty-page ns-empty">
                  <Calendar size={48} />
                  <h3>No appointments yet</h3>
                  <p>Choose Exterior, Interior, or Full vehicle — then Essential, Signature, or Elite. Dispatch picks up the request from here.</p>
                  <button className="btn-primary" onClick={openBook}>Book a self</button>
                </div>
              ) : (
                <div className="apt-list">
                  {appointments.map(apt => (
                    <div key={apt.id} className="apt-card">
                      <div className="apt-card-main">
                        <div className="apt-icon"><Car size={20} /></div>
                        <div className="apt-info">
                          <h4>{apt.service_name}</h4>
                          {(apt.add_ons?.length ?? 0) > 0 && (
                            <p className="apt-addons">+ {(apt.add_ons || []).join(', ')}</p>
                          )}
                          {apt.vehicle_info && <p className="apt-vehicle">{apt.vehicle_info}</p>}
                          {apt.scheduled_at && (
                            <p className="apt-date">
                              <Clock size={12} /> {new Date(apt.scheduled_at).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <div className="apt-right">
                          <StatusBadge status={apt.status} />
                          <div className="apt-card-price">{money(apt.price)}</div>
                        </div>
                      </div>
                      <AppointmentProgress appointment={apt} />
                      {apt.notes && (
                        <div className="apt-notes">
                          <span>Notes:</span> {apt.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SUBSCRIPTION */}
          {tab === 'subscription' && (
            <div className="tab-content">
              <PortalPageHead
                kicker="Membership"
                title="Membership plans"
                lead="Keep Signature visits on a monthly cadence. Switch or cancel any time."
              />
              {subscribeNotice && (
                <div className="current-plan-banner">
                  <div>
                    <span>Membership request</span>
                    <strong>Pending confirmation</strong>
                    <p>{subscribeNotice}</p>
                  </div>
                  <StatusBadge status="pending" />
                </div>
              )}
              {subscription && (
                <div className="current-plan-banner">
                  <div>
                    <span>Current plan</span>
                    <strong>{subscription.plan_name}</strong>
                    <p>Next detail: {subscription.next_detail_date ? new Date(subscription.next_detail_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD'}</p>
                  </div>
                  <StatusBadge status={subscription.status} />
                </div>
              )}
              <div className="plan-grid">
                {MEMBERSHIPS.map((plan, i) => {
                  const isCurrent = subscription?.plan_name === plan.name;
                  return (
                    <div key={plan.name} className={`plan-card ${i === 1 ? 'plan-featured' : ''} ${isCurrent ? 'plan-current' : ''}`}>
                      {i === 1 && <div className="plan-badge">Most Popular</div>}
                      {isCurrent && <div className="plan-badge plan-badge-active">Your Plan</div>}
                      <h3>{plan.name}</h3>
                      <div className="plan-price">{money(plan.price)}<small>/month</small></div>
                      <p>{plan.desc}</p>
                      <ul>
                        {plan.features.map(f => <li key={f}><CheckCircle size={13} /> {f}</li>)}
                      </ul>
                      <div className="plan-savings-note">
                        <Shield size={12} /> {plan.savings}
                      </div>
                      {!isCurrent && (
                        <button
                          className={i === 1 ? 'btn-primary btn-full' : 'btn-outline btn-full'}
                          disabled={subscribeBusy}
                          onClick={() => handleSubscribe(plan)}
                        >
                          {subscription ? 'Switch to this plan' : `Join ${plan.name}`}
                        </button>
                      )}
                      {isCurrent && (
                        <button
                          className="btn-outline btn-full btn-cancel"
                          onClick={async () => {
                            await supabase.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', subscription.id);
                            setSubscription(null);
                          }}
                        >
                          Cancel Membership
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* BILLING */}
          {tab === 'billing' && (
            <div className="tab-content">
              <PortalPageHead
                kicker="Care"
                title="Billing & savings"
                lead="Track what you have invested in this vehicle — and the protection that comes with it."
              />
              {accountCredit > 0 && (
                <div className="current-plan-banner referral-credit-card">
                  <div>
                    <span>Referral credit</span>
                    <strong>{money(accountCredit)} on this account</strong>
                    <p>Applied automatically the next time you book a visit.</p>
                  </div>
                </div>
              )}

              {/* Savings Hero */}
              <div className="billing-savings-card">
                <div className="billing-savings-header">
                  <div>
                    <h3><TrendingUp size={20} /> Lifetime Investment Analysis</h3>
                    <p>Your vehicle is one of your largest assets. Professional care protects its value.</p>
                  </div>
                </div>
                {lifetimeSpend > 0 ? (
                  <>
                    <SavingsBar spent={lifetimeSpend} savings={lifetimeSavings} />
                    <div className="savings-breakdown">
                      <h4>How we calculate your savings</h4>
                      <div className="savings-items">
                        <div className="savings-item">
                          <span>Paint fading prevention</span>
                          <strong>{money(Math.round(lifetimeSpend * 1.5))}</strong>
                        </div>
                        <div className="savings-item">
                          <span>Interior wear protection</span>
                          <strong>{money(Math.round(lifetimeSpend * 0.8))}</strong>
                        </div>
                        <div className="savings-item">
                          <span>Resale value boost (est.)</span>
                          <strong>{money(Math.round(lifetimeSpend * 1.0))}</strong>
                        </div>
                        <div className="savings-item">
                          <span>Contaminant damage avoided</span>
                          <strong>{money(Math.round(lifetimeSpend * 0.5))}</strong>
                        </div>
                        <div className="savings-item savings-total">
                          <span>Total estimated savings</span>
                          <strong>{money(lifetimeSavings)}</strong>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-state">
                    <TrendingUp size={36} />
                    <p>Start your Luxe journey to track your vehicle's protection value.</p>
                    <button className="btn-primary" onClick={openBook}>Book Your First Detail</button>
                  </div>
                )}
              </div>

              {/* Payment history */}
              <div className="payment-history">
                <h3>Payment History</h3>
                {payments.length === 0 ? (
                  <p className="empty-text">No payments on record yet.</p>
                ) : (
                  <div className="payment-list">
                    {payments.map(p => (
                      <div key={p.id} className="payment-row">
                        <div className="payment-icon"><CreditCard size={16} /></div>
                        <div className="payment-info">
                          <strong>{p.description ?? 'Service Payment'}</strong>
                          <span>{new Date(p.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="payment-amount">
                          <strong>{money(p.amount)}</strong>
                          <StatusBadge status={p.status} />
                        </div>
                      </div>
                    ))}
                    <div className="payment-total-row">
                      <span>Total invested in care</span>
                      <strong>{money(lifetimeSpend)}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Book Modal */}
      {showBook && (
        <div className="modal-overlay" onClick={() => setShowBook(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="eyebrow">Book a self</span>
                <h3>Schedule a detail</h3>
              </div>
              <button onClick={() => setShowBook(false)}><X size={20} /></button>
            </div>
            {bookDone ? (
              <div className="modal-success portal-book-confirm">
                <CheckCircle size={48} />
                <span className="eyebrow">Requested</span>
                <h4>You're on the board</h4>
                <p>We'll confirm {lastBook?.name || 'this self'}. Dispatch will assign a technician.</p>
                <dl className="portal-book-facts">
                  <div><dt>Self</dt><dd>{lastBook?.name || bookedPkg.name}</dd></div>
                  <div><dt>When</dt><dd>{lastBook?.when || '—'}</dd></div>
                  <div><dt>Price</dt><dd>{money(lastBook?.price || 0)}</dd></div>
                  {lastBook?.addOns ? <div><dt>Add-ons</dt><dd>{lastBook.addOns}</dd></div> : null}
                </dl>
                <button type="button" className="btn-primary" onClick={() => { setShowBook(false); setBookDone(false); }}>Done</button>
              </div>
            ) : (
              <form className="modal-form" onSubmit={handleBookSubmit}>
                <div className="form-group">
                  <label>Service</label>
                  <DetailSelfPicker
                    family={bookFamily}
                    self={bookSelf}
                    onChange={(family, self) => {
                      setBookFamily(family);
                      setBookSelf(self);
                      if (bookDate) void loadAvailableTimes(bookDate, family, self);
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Vehicle Size</label>
                  <select value={bookVehicle} onChange={e => setBookVehicle(Number(e.target.value))}>
                    {VEHICLE_SIZES.map((v, i) => (
                      <option key={v.name} value={i}>{v.name}{v.extra ? ` (+$${v.extra})` : ''}</option>
                    ))}
                  </select>
                </div>
<div className="form-group">
  <label>Appointment Date</label>

  <input
    type="date"
    required
    min={todayYmdInZone()}
    value={bookDate}
    onChange={e => loadAvailableTimes(e.target.value)}
  />
</div>

{bookDate && (
  <div className="form-group">
    <label>Available Times</label>

    {timesLoading ? (
      <p>Checking available times...</p>
    ) : availabilityError ? (
      <p className="d2d-house-discovery error">
        Could not check this date.
        <button type="button" onClick={() => void loadAvailableTimes(bookDate)}>Retry</button>
      </p>
    ) : dayClosed ? (
      <p style={{ color: '#6f655b' }}>
        This date is closed. Pick another day.
      </p>
    ) : availableTimes.length === 0 ? (
      <p style={{ color: '#6f655b' }}>
        Every open window on this date is already booked.
      </p>
    ) : (
      <div className="mini-addons">
        {availableTimes.map(time => (
          <button
            key={time}
            type="button"
            className={`mini-addon ${
              bookTime === time ? 'mini-active' : ''
            }`}
            onClick={() => setBookTime(time)}
          >
            {new Date(`2000-01-01T${time}:00`).toLocaleTimeString(
              'en-US',
              {
                hour: 'numeric',
                minute: '2-digit',
              }
            )}
          </button>
        ))}
      </div>
    )}
    <p className="portal-travel-note">Open times already include the last job’s length plus a travel buffer, so the next stop is not booked too close.</p>
  </div>
)}
                
                <div className="form-group">
                  <label>Add-Ons</label>
                  <div className="mini-addons">
                    {ADD_ONS.map(([name, price], i) => (
                      <button type="button" key={name} className={`mini-addon ${bookAddOns.includes(i) ? 'mini-active' : ''}`} onClick={() => setBookAddOns(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}>
                        {name}<span>+${price}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea rows={2} placeholder="Anything about your vehicle we should know..." value={bookNotes} onChange={e => setBookNotes(e.target.value)} />
                </div>
                <div className="modal-total">
                  <span>Estimated total</span>
                  <strong>
                    {(() => {
                      const gross = bookedPkg.price + VEHICLE_SIZES[bookVehicle].extra + bookAddOns.reduce((s, i) => s + ADD_ONS[i][1], 0);
                      const due = Math.max(0, gross - accountCredit);
                      return due < gross ? `${money(due)} after ${money(Math.min(accountCredit, gross))} credit` : money(gross);
                    })()}
                  </strong>
                </div>
                <button type="submit" className="btn-primary btn-full" disabled={bookSubmitting}>
                  {bookSubmitting ? 'Sending request…' : 'Request appointment'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
        <nav className="os-mobile-bottom-nav mobile-app-nav-v25" aria-label="Customer navigation">
          {navItems.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
              <Icon size={20} /><span>{label === 'My Appointments' ? 'Jobs' : label === 'Billing & Savings' ? 'Billing' : label}</span>
            </button>
          ))}
        </nav>
    </div>
  );
}
