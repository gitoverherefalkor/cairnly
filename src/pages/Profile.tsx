import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  User,
  Save,
  FileText,
  CheckCircle,
  Bell,
  Download,
  Trash2,
  Shield,
  Loader2,
} from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DashboardAppNav } from '@/components/dashboard/v2/DashboardAppNav';
import { ResumeUploadCard } from '@/components/resume/ResumeUploadCard';
import { useSurveyDerivedProfile } from '@/hooks/useSurveyDerivedProfile';

// ----- Shared cream card shell for every Profile section -----
interface ProfileCardProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ icon: Icon, title, danger = false, children }) => (
  <section
    className="relative overflow-hidden rounded-[20px] border"
    style={{
      background: '#FDFBF2',
      borderColor: danger ? 'rgba(220,38,38,0.32)' : 'rgba(201, 182, 144, 0.6)',
      boxShadow: '0 28px 56px -22px rgba(0,0,0,0.45)',
      padding: '24px 28px 22px',
    }}
  >
    {/* Soft gold radial bloom — suppressed on danger card */}
    {!danger && (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: -60,
          right: -60,
          width: 240,
          height: 240,
          background:
            'radial-gradient(circle, rgba(212,160,36,0.14) 0%, rgba(212,160,36,0) 70%)',
        }}
      />
    )}
    <div className="relative">
      <div className="flex items-center gap-2.5 mb-1">
        <Icon className="h-[18px] w-[18px]" style={{ color: danger ? '#DC2626' : '#1F8282' }} />
        <span
          className="font-heading uppercase text-[11px]"
          style={{
            color: danger ? '#DC2626' : '#1F8282',
            letterSpacing: '0.22em',
            fontWeight: 700,
          }}
        >
          {title}
        </span>
      </div>
      <div className="mt-3.5">{children}</div>
    </div>
  </section>
);

// ----- Shared form styles for cream-card inputs -----
const inputCls =
  'bg-[#FFFDF5] border-[rgba(201,182,144,0.8)] text-[#122E3B] placeholder:text-[#9CA3AF] focus-visible:ring-atlas-teal/40';
const inputDisabledCls = 'bg-[#F3EEDC] border-[rgba(201,182,144,0.8)] text-[#6B7F8B] cursor-not-allowed';
const labelCls = 'block text-[13px] font-semibold mb-1.5';
const labelStyle = { color: '#122E3B' };
const helperCls = 'text-[11.5px] font-medium mt-1.5';
const helperStyle = { color: '#6B7F8B' };

const Profile = () => {
  const { user } = useAuth();
  const { profile, updateProfile, isUpdating } = useProfile();
  // Survey-derived fallbacks for fields that already exist as Section 1 answers
  // (pronouns, age range). When the user submits Save, the chosen values get
  // persisted to profiles, so this is a one-time pre-fill — after that, the
  // profile row itself is the source of truth.
  const { data: surveyDerived } = useSurveyDerivedProfile();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    country: profile?.country || '',
    region: profile?.region || '',
    pronouns: profile?.pronouns || surveyDerived.pronouns || '',
    age_range: profile?.age_range || surveyDerived.ageRange || '',
  });

  const [emailReminders, setEmailReminders] = useState(
    (profile as any)?.email_reminders_enabled ?? true
  );

  React.useEffect(() => {
    if (profile) {
      setFormData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        country: profile.country || '',
        region: profile.region || '',
        // Fall back to survey-derived values when the profile field is empty.
        pronouns: profile.pronouns || surveyDerived.pronouns || '',
        age_range: profile.age_range || surveyDerived.ageRange || '',
      });
      setEmailReminders((profile as any)?.email_reminders_enabled ?? true);
    }
  }, [profile, surveyDerived.pronouns, surveyDerived.ageRange]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile(formData);
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-user-data');
      if (error) throw error;

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cairnly-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({ title: 'Data exported', description: 'Your data has been downloaded as a JSON file.' });
    } catch (err: any) {
      console.error('Export error:', err);
      toast({
        title: 'Export failed',
        description: 'Something went wrong. Please try again or contact support.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-user-data');
      if (error) throw error;

      // Sign out and redirect — local scope (global is 403-ing on this project)
      await supabase.auth.signOut({ scope: 'local' });
      navigate('/');
    } catch (err: any) {
      console.error('Delete error:', err);
      toast({
        title: 'Deletion failed',
        description: 'Something went wrong. Please contact support at privacy@cairnly.io',
        variant: 'destructive',
      });
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    navigate('/');
  };

  // Redirect in useEffect, not during render (prevents blank page flash)
  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
    }
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const firstName = profile?.first_name || '';

  return (
    <div className="min-h-screen survey-bg">
      {/* Sticky cream top nav — same pattern as /dashboard, /jobs, /chat */}
      <DashboardAppNav
        firstName={firstName}
        pageLabel="Profile Settings"
        onProfile={() => {/* already on profile */}}
        onSignOut={handleSignOut}
        onBack={() => navigate('/dashboard')}
        backLabel="Back to dashboard"
      />

      <div className="max-w-[880px] mx-auto px-6 sm:px-8 pt-10 pb-20">
        {/* Page header */}
        <div className="mb-8">
          <span
            className="font-heading uppercase text-[11px]"
            style={{ color: '#EFBE48', letterSpacing: '0.24em', fontWeight: 700 }}
          >
            Your Account
          </span>
          <h1
            className="font-heading text-white m-0 mt-2.5"
            style={{
              fontSize: 'clamp(28px, 5vw, 44px)',
              fontWeight: 700,
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
            }}
          >
            Profile settings
          </h1>
          <p
            className="text-[15px] mt-1.5 max-w-xl"
            style={{ color: 'rgba(255,255,255,0.65)', fontWeight: 500, lineHeight: 1.5 }}
          >
            Manage what we know about you, how we email you, and your data.
          </p>
        </div>

        {/* Cards stack */}
        <div className="flex flex-col gap-[18px]">
          {/* ----- Resume Status ----- */}
          <ProfileCard icon={FileText} title="Resume / CV status">
            {profile?.resume_uploaded_at ? (
              <>
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'rgba(34, 197, 94, 0.14)',
                      border: '1px solid rgba(34, 197, 94, 0.32)',
                    }}
                  >
                    <CheckCircle className="h-5 w-5" style={{ color: '#16A34A' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14.5px] font-bold" style={{ color: '#122E3B' }}>
                      Resume uploaded successfully
                    </p>
                    <p className="text-[12.5px] font-medium mt-0.5" style={{ color: '#6B7F8B' }}>
                      Uploaded on {new Date(profile.resume_uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full font-bold text-[12.5px] bg-transparent"
                    style={{ color: '#1F8282', borderColor: 'rgba(31,130,130,0.32)' }}
                    onClick={async () => {
                      if (!user?.id) return;

                      // Delete the actual files in storage first, otherwise
                      // they orphan and the next upload's "find latest" picks
                      // up a stale file.
                      const { data: files } = await supabase.storage
                        .from('resumes')
                        .list(user.id, { limit: 100 });

                      if (files?.length) {
                        const paths = files.map((f) => `${user.id}/${f.name}`);
                        await supabase.storage.from('resumes').remove(paths);
                      }

                      const { error } = await supabase
                        .from('profiles')
                        .update({
                          resume_data: null,
                          resume_parsed_data: null,
                          resume_uploaded_at: null,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', user.id);

                      if (!error) {
                        window.location.reload();
                      }
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3.5">
                  <div
                    className="w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ border: '2px solid rgba(201,182,144,0.7)' }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ background: '#9CA3AF' }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14.5px] font-bold" style={{ color: '#122E3B' }}>
                      No resume uploaded
                    </p>
                    <p className="text-[12.5px] font-medium mt-0.5" style={{ color: '#6B7F8B' }}>
                      Upload one here, or do it when starting your next Cairnly Assessment for automatic pre-filling.
                    </p>
                  </div>
                </div>

                {/* Upload affordance — feeds the same useResumeUpload hook the
                    assessment intake uses, so it writes resume_uploaded_at on
                    the profile and lands the file in the resumes bucket. */}
                <div className="mt-4">
                  <ResumeUploadCard
                    title="Upload résumé"
                    description="PDF, Word (.doc, .docx), or plain text. Used to pre-fill your assessment and to tailor résumés for selected careers."
                    showSuccessMessage
                    onProcessingComplete={() => {
                      // Reload so the card flips to the "uploaded" state.
                      window.location.reload();
                    }}
                  />
                </div>
              </>
            )}
          </ProfileCard>

          {/* ----- Personal Information ----- */}
          <ProfileCard icon={User} title="Personal information">
            <form onSubmit={handleSubmit}>
              {/* First + Last */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
                <div>
                  <label htmlFor="first_name" className={labelCls} style={labelStyle}>
                    First Name
                  </label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    placeholder="Enter your first name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="last_name" className={labelCls} style={labelStyle}>
                    Last Name
                  </label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    placeholder="Enter your last name"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Email (disabled) */}
              <div className="mb-4">
                <label htmlFor="email" className={labelCls} style={labelStyle}>
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={profile?.email || user?.email || ''}
                  disabled
                  className={inputDisabledCls}
                />
                <p className={helperCls} style={helperStyle}>
                  Email cannot be changed from this page
                </p>
              </div>

              {/* Sign-in Method (disabled) */}
              <div className="mb-4">
                <label htmlFor="auth_provider" className={labelCls} style={labelStyle}>
                  Sign-in Method
                </label>
                <Input
                  id="auth_provider"
                  value={
                    profile?.auth_provider === 'google'
                      ? 'Google'
                      : profile?.auth_provider === 'linkedin_oidc'
                        ? 'LinkedIn'
                        : profile?.auth_provider === 'email'
                          ? 'Email/Password'
                          : 'Email/Password'
                  }
                  disabled
                  className={inputDisabledCls}
                />
                <p className={helperCls} style={helperStyle}>
                  The authentication method used to create your account
                </p>
              </div>

              {/* Country + Region */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
                <div>
                  <label htmlFor="country" className={labelCls} style={labelStyle}>
                    Country
                  </label>
                  <Input
                    id="country"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    placeholder="Enter your country"
                    className={inputCls}
                  />
                  <p className={helperCls} style={helperStyle}>
                    From payment form
                  </p>
                </div>
                <div>
                  <label htmlFor="region" className={labelCls} style={labelStyle}>
                    Region
                  </label>
                  <Input
                    id="region"
                    value={formData.region}
                    disabled
                    className={inputDisabledCls}
                    placeholder="No region set"
                  />
                  <p className={helperCls} style={helperStyle}>
                    From survey Section 1
                  </p>
                </div>
              </div>

              {/* Pronouns */}
              <div className="mb-4" style={{ width: '40%', minWidth: 200 }}>
                <label htmlFor="pronouns" className={labelCls} style={labelStyle}>
                  Pronouns
                </label>
                <Select
                  value={formData.pronouns}
                  onValueChange={(value) => handleInputChange('pronouns', value)}
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Select your pronouns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="he/him">he/him</SelectItem>
                    <SelectItem value="she/her">she/her</SelectItem>
                    <SelectItem value="they/them">they/them</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Age Range */}
              <div style={{ width: '40%', minWidth: 200 }}>
                <label htmlFor="age_range" className={labelCls} style={labelStyle}>
                  Age Range
                </label>
                <Select
                  value={formData.age_range}
                  onValueChange={(value) => handleInputChange('age_range', value)}
                >
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Select your age range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="18-24">18-24</SelectItem>
                    <SelectItem value="25-34">25-34</SelectItem>
                    <SelectItem value="35-44">35-44</SelectItem>
                    <SelectItem value="45-54">45-54</SelectItem>
                    <SelectItem value="55-64">55-64</SelectItem>
                    <SelectItem value="65+">65+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Save button row with hairline divider */}
              <div
                className="flex justify-end mt-[18px] pt-4"
                style={{ borderTop: '1px solid rgba(201,182,144,0.5)' }}
              >
                <Button
                  type="submit"
                  disabled={isUpdating}
                  className="rounded-full bg-atlas-teal text-white hover:bg-atlas-teal/90 font-bold text-[13.5px] px-5 shadow-[0_10px_24px_-8px_rgba(39,161,161,0.45)]"
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </ProfileCard>

          {/* ----- Email Preferences ----- */}
          <ProfileCard icon={Bell} title="Email preferences">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="text-[14px] font-bold" style={{ color: '#122E3B' }}>
                  Email Reminders
                </p>
                <p
                  className="text-[13px] font-medium mt-1 max-w-md"
                  style={{ color: '#6B7F8B', lineHeight: 1.5 }}
                >
                  Receive helpful reminders to continue your assessment and explore your career insights
                </p>
              </div>
              <Switch
                checked={emailReminders}
                onCheckedChange={async (checked) => {
                  setEmailReminders(checked);
                  // Save immediately — no need to hit Save button
                  const { error } = await supabase
                    .from('profiles')
                    .update({
                      email_reminders_enabled: checked,
                      updated_at: new Date().toISOString(),
                    } as any)
                    .eq('id', user?.id);

                  if (error) {
                    console.error('Failed to update email preference:', error);
                    setEmailReminders(!checked); // revert on error
                  }
                }}
                className="data-[state=checked]:bg-atlas-teal data-[state=unchecked]:bg-[rgba(75,99,115,0.3)]"
              />
            </div>
          </ProfileCard>

          {/* ----- Your Data (GDPR) ----- */}
          <ProfileCard icon={Shield} title="Your data">
            <p className="text-[14px] font-medium mb-4" style={{ color: '#1F2937', lineHeight: 1.6 }}>
              You have the right to download a copy of all your personal data, or request its
              permanent deletion. See our{' '}
              <a
                href="/privacy-policy"
                className="underline hover:opacity-80"
                style={{ color: '#1F8282' }}
              >
                Privacy Policy
              </a>{' '}
              for more details.
            </p>
            <Button
              variant="outline"
              onClick={handleExportData}
              disabled={isExporting}
              className="rounded-full bg-transparent font-bold text-[13px]"
              style={{ color: '#1F8282', borderColor: 'rgba(31,130,130,0.32)' }}
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download My Data
                </>
              )}
            </Button>
          </ProfileCard>

          {/* ----- Delete Account ----- */}
          <ProfileCard icon={Trash2} title="Delete account" danger>
            {!showDeleteConfirm ? (
              <>
                <p className="text-[14px] font-medium mb-4" style={{ color: '#1F2937', lineHeight: 1.6 }}>
                  Permanently delete your account and all associated data including assessment
                  results, career reports, chat history, and uploaded documents. This action
                  cannot be undone.
                </p>
                <Button
                  variant="outline"
                  className="rounded-full bg-transparent font-bold text-[13px]"
                  style={{ color: '#DC2626', borderColor: 'rgba(220,38,38,0.4)' }}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete My Account
                </Button>
              </>
            ) : (
              <div
                className="rounded-xl p-[18px]"
                style={{
                  background: 'rgba(220, 38, 38, 0.06)',
                  border: '1px solid rgba(220, 38, 38, 0.28)',
                }}
              >
                <p className="text-[14px] font-bold mb-3" style={{ color: '#991B1B' }}>
                  Are you sure? This will permanently delete:
                </p>
                <ul
                  className="list-disc pl-[22px] text-[13.5px] font-medium mb-3.5"
                  style={{ color: '#B91C1C', lineHeight: 1.8 }}
                >
                  <li>Your profile and personal information</li>
                  <li>All assessment responses</li>
                  <li>Career reports and recommendations</li>
                  <li>Chat conversation history</li>
                  <li>Uploaded resume/CV files</li>
                </ul>
                <p className="text-[13.5px] font-bold mb-4" style={{ color: '#991B1B' }}>
                  This cannot be undone. You will be signed out immediately.
                </p>
                <div className="flex gap-2.5 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isDeleting}
                    className="rounded-full bg-transparent font-bold text-[13px]"
                    style={{ color: '#4B6373', borderColor: 'rgba(75,99,115,0.3)' }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={isDeleting}
                    className="rounded-full text-white font-bold text-[13px] shadow-[0_8px_20px_-8px_rgba(220,38,38,0.55)] hover:opacity-90"
                    style={{ background: '#DC2626' }}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Yes, Delete Everything
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </ProfileCard>
        </div>
      </div>
    </div>
  );
};

export default Profile;
