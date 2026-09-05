import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, CreditCard, Star, Plus, LogOut,
  TrendingUp, Shield, Clock, CheckCircle, ChevronRight, Menu, X,
  Car, Sparkles, ArrowUp
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Appointment, Payment, Subscription } from '@/lib/supabase';
import { money, calcSavings, PACKAGES, ADD_ONS, VEHICLE_SIZES, MEMBERSHIPS } from '@/lib/data';
import { sendCommunication } from '@/lib/communications';
import EmployeeAvatar from '@/components/EmployeeAvatar';

type Tab = 'dashboard' | 'appointments' | 'subscription' | 'billing';

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'badge-yellow',
    confirmed: 'badge-blue',
    in_progress: 'badge-purple',
    completed: 'badge-green',
    cancelled: 'badge-red',
    active: 'badge-green',
    paused: 'badge-yellow',
  };
  return <span className={`status-badge ${colors[status] ?? 'badge-gray'}`}>{status.replace('_', ' ')}</span>;
}

function AppointmentProgress({appointment,compact=false}:{appointment:Appointment;compact?:boolean}){
  const field=String((appointment as any).field_status||'').toLowerCase();
  const status=String(appointment.status||'').toLowerCase();
  const stage=status==='completed'||field==='completed'||field==='finished'?4:field==='started'||status==='in_progress'?3:field==='arrived'||field==='en_route'?2:appointment.assigned_employee_id?1:0;
  const steps=['Confirmed','Detailer Assigned','En Route','In Progress','Complete'];
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

  // Booking form state
  const [showBook, setShowBook] = useState(false);
  const [bookPkg, setBookPkg] = useState(1);
  const [bookVehicle, setBookVehicle] = useState(0);
  const [bookAddOns, setBookAddOns] = useState<number[]>([]);
  const [bookNotes, setBookNotes] = useState('');
  const [bookSubmitting, setBookSubmitting] = useState(false);
  const [bookDate, setBookDate] = useState('');
const [bookTime, setBookTime] = useState('');
const [availableTimes, setAvailableTimes] = useState<string[]>([]);
const [timesLoading, setTimesLoading] = useState(false);
  const [bookDone, setBookDone] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [apts, pays, subs] = await Promise.all([
        supabase.from('appointments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('*').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      ]);
      setAppointments(apts.data ?? []);
      setPayments(pays.data ?? []);
      setSubscription(subs.data ?? null);
      setDataLoading(false);
    })();
  }, [user]);

  const lifetimeSpend = payments.reduce((s, p) => s + p.amount, 0);
  const lifetimeSavings = calcSavings(lifetimeSpend);
  const upcomingAppointment = appointments.find(a => a.status !== 'completed' && a.status !== 'cancelled');

  const handleSignOut = async () => {
    await signOut().catch(() => {});
    navigate('/');
  };

  const loadAvailableTimes = async (date: string) => {
  setBookDate(date);
  setBookTime('');
  setAvailableTimes([]);

  if (!date) return;

  setTimesLoading(true);

  try {
    const { data: dayAvailability, error: availabilityError } =
      await supabase
        .from('availability')
        .select('*')
        .eq('date', date)
        .maybeSingle();

    if (availabilityError) throw availabilityError;

    if (!dayAvailability || !dayAvailability.is_available) {
      setAvailableTimes([]);
      return;
    }

    const { data: booked, error: bookedError } = await supabase.rpc(
      'get_booked_times',
      {
        for_date: date,
      }
    );

    if (bookedError) throw bookedError;

    const bookedTimes = new Set(
      (booked ?? []).map((item: any) =>
        new Date(item.scheduled_at).toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
        })
      )
    );

    const slots: string[] = [];

    const startValue=dayAvailability.start_time||'09:00';
    const endValue=dayAvailability.end_time||'17:00';
    const slotMinutes=Math.max(15,Number(dayAvailability.slot_minutes||60));
    const [startHour, startMinute] = startValue.split(':').map(Number);

    const [endHour, endMinute] = endValue.split(':').map(Number);

    let current = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;

    while (current + slotMinutes <= end) {
      const hours = Math.floor(current / 60);
      const minutes = current % 60;

      const value =
        `${String(hours).padStart(2, '0')}:` +
        `${String(minutes).padStart(2, '0')}`;

      if (!bookedTimes.has(value)) {
        slots.push(value);
      }

      current += slotMinutes;
    }

    setAvailableTimes(slots);
  } catch (error) {
    console.error('Availability error:', error);
    setAvailableTimes([]);
  } finally {
    setTimesLoading(false);
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
    const price =
      PACKAGES[bookPkg].price +
      VEHICLE_SIZES[bookVehicle].extra +
      bookAddOns.reduce((sum, i) => sum + ADD_ONS[i][1], 0);

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert({
        user_id: user.id,
        customer_name: profile?.full_name ?? null,
        customer_email: user.email ?? null,
        customer_phone: profile?.phone ?? null,
        service_name: PACKAGES[bookPkg].name,
        scheduled_at: new Date(
  `${bookDate}T${bookTime}:00`
).toISOString(),
        package_name: PACKAGES[bookPkg].name,
        add_ons: bookAddOns.map(i => ADD_ONS[i][0]),
        vehicle_info: profile?.vehicle_info ?? '',
        price,
        notes: bookNotes,
        status: 'pending',
      })
      .select()
      .single();

    if (appointmentError) throw appointmentError;

    const { error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id: user.id,
        appointment_id: appointment.id,
        amount: price,
        status: 'pending',
        description: PACKAGES[bookPkg].name,
      });

    if (paymentError) throw paymentError;

    if (user.email) {
      sendCommunication('booking_received', {
        appointment_id: appointment.id,
        recipient_email: user.email,
        variables: {
          customer_name: profile?.full_name || 'Customer',
          service_name: PACKAGES[bookPkg].name,
          appointment_date: new Date(appointment.scheduled_at).toLocaleDateString('en-US'),
          appointment_time: new Date(appointment.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        },
      }).catch(console.warn);
    }

    navigate('/checkout', {
  state: {
    appointmentId: appointment.id,
    amount: price,
    serviceName: PACKAGES[bookPkg].name,
    servicePrice: PACKAGES[bookPkg].price,
    vehicleName: VEHICLE_SIZES[bookVehicle].name,
    vehicleExtra: VEHICLE_SIZES[bookVehicle].extra,
    addOns: bookAddOns.map(i => ({
      name: ADD_ONS[i][0],
      price: ADD_ONS[i][1],
    })),
  },
});
  } catch (error) {
    console.error('Booking/payment error:', error);

    alert(
      error instanceof Error
        ? error.message
        : 'Unable to start payment. Please try again.'
    );

    setBookSubmitting(false);
  }
};
  const handleSubscribe = async (plan: typeof MEMBERSHIPS[0]) => {
  if (!user) return;

  try {
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);

    const { data: newSubscription, error } = await supabase
      .from('subscriptions')
      .insert({
        user_id: user.id,
        plan_name: plan.name,
        plan_price: plan.price,

        // Don't activate until payment succeeds
        status: 'pending',

        next_detail_date: nextDate.toISOString().split('T')[0],
        billing_cycle_start: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) throw error;

    navigate('/checkout', {
      state: {
        paymentType: 'membership',
        subscriptionId: newSubscription.id,

        amount: plan.price,

        serviceName: `${plan.name} Membership`,
        servicePrice: plan.price,

        vehicleName: '',
        vehicleExtra: 0,
        addOns: [],
      },
    });
  } catch (error) {
    console.error('Membership checkout error:', error);

    alert(
      error instanceof Error
        ? error.message
        : 'Unable to start membership payment.'
    );
  }
};

  const navItems: { id: Tab; label: string; Icon: any }[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { id: 'appointments', label: 'My Appointments', Icon: Calendar },
    { id: 'subscription', label: 'Membership', Icon: Star },
    { id: 'billing', label: 'Billing & Savings', Icon: CreditCard },
  ];

  return (
    <div className="portal-layout">
      {/* Sidebar */}
      <aside className={`portal-sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand">
            <div className="brand-mark brand-mark-sm">NS</div>
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
      <main className="portal-main">
        <div className="portal-topbar">
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="topbar-title">
            <h1>{navItems.find(n => n.id === tab)?.label}</h1>
          </div>
          <button className="btn-primary topbar-book" onClick={() => setShowBook(true)}>
            <Plus size={16} /> Book Service
          </button>
        </div>

        <div className="portal-content">

          {/* DASHBOARD */}
          {tab === 'dashboard' && (
            <div className="dashboard-grid">
              <div className="dash-welcome">
                <div>
                  <h2>Welcome back, {profile?.full_name?.split(' ')[0] ?? 'there'}.</h2>
                  <p>Here's an overview of your vehicle's care history.</p>
                </div>
                <button className="btn-primary" onClick={() => setShowBook(true)}>
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
                  <div className="empty-state">
                    <Sparkles size={32} />
                    <p>No upcoming appointments.</p>
                    <button className="btn-primary" onClick={() => setShowBook(true)}>Book Now</button>
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
                  <div className="empty-state">
                    <Star size={32} />
                    <p>No active membership.</p>
                    <button className="btn-outline" onClick={() => setTab('subscription')}>Explore Plans</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* APPOINTMENTS */}
          {tab === 'appointments' && (
            <div className="tab-content">
              <div className="tab-header">
                <div>
                  <h2>Your Appointments</h2>
                  <p>{appointments.length} total service{appointments.length !== 1 ? 's' : ''}</p>
                </div>
                <button className="btn-primary" onClick={() => setShowBook(true)}>
                  <Plus size={16} /> New Appointment
                </button>
              </div>

              {appointments.length === 0 ? (
                <div className="empty-page">
                  <Calendar size={48} />
                  <h3>No appointments yet</h3>
                  <p>Book your first Luxe service to get started.</p>
                  <button className="btn-primary" onClick={() => setShowBook(true)}>Book Now</button>
                </div>
              ) : (
                <div className="apt-list">
                  {appointments.map(apt => (
                    <div key={apt.id} className="apt-card">
                      <div className="apt-card-main">
                        <div className="apt-icon"><Car size={20} /></div>
                        <div className="apt-info">
                          <h4>{apt.service_name}</h4>
                          {apt.add_ons.length > 0 && (
                            <p className="apt-addons">+ {apt.add_ons.join(', ')}</p>
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
              <h2>Membership Plans</h2>
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
              <h2>Billing & Savings</h2>
              <p className="tab-sub">Track what you've invested in your vehicle's care — and how much it's protecting your investment.</p>

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
                    <button className="btn-primary" onClick={() => setShowBook(true)}>Book Your First Detail</button>
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
              <h3>Book a Service</h3>
              <button onClick={() => setShowBook(false)}><X size={20} /></button>
            </div>
            {bookDone ? (
              <div className="modal-success">
                <CheckCircle size={48} />
                <h4>Appointment Requested!</h4>
                <p>We'll be in touch to confirm your booking.</p>
              </div>
            ) : (
              <form className="modal-form" onSubmit={handleBookSubmit}>
                <div className="form-group">
                  <label>Package</label>
                  <div className="pkg-choices">
                    {PACKAGES.map((p, i) => (
                      <button type="button" key={p.name} className={`pkg-choice ${bookPkg === i ? 'pkg-active' : ''}`} onClick={() => setBookPkg(i)}>
                        <span>{p.name}</span>
                        <strong>{money(p.price)}+</strong>
                      </button>
                    ))}
                  </div>
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
    min={new Date().toISOString().split('T')[0]}
    value={bookDate}
    onChange={e => loadAvailableTimes(e.target.value)}
  />
</div>

{bookDate && (
  <div className="form-group">
    <label>Available Times</label>

    {timesLoading ? (
      <p>Checking available times...</p>
    ) : availableTimes.length === 0 ? (
      <p style={{ color: '#999' }}>
        No appointments available on this date.
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
                  <strong>{money(PACKAGES[bookPkg].price + VEHICLE_SIZES[bookVehicle].extra + bookAddOns.reduce((s, i) => s + ADD_ONS[i][1], 0))}</strong>
                </div>
                <button type="submit" className="btn-primary btn-full" disabled={bookSubmitting}>
                  {bookSubmitting ? 'Opening Square...' : 'Continue to Payment'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
