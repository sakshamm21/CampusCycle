'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MapView, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import {
  Save,
  Sparkles,
  MapPin,
  Bot,
  Wrench,
  FileText,
  TrendingUp,
  ShieldCheck,
  Loader2,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import {
  updateCollegeSettings,
  updateAiSettings,
  toAppError,
  messageFor,
  en,
  type Database,
} from '@campuscycle/shared';

interface TorqFeatures {
  rider_assistant: boolean;
  return_photo_check: boolean;
  snap_to_report: boolean;
  id_card_check: boolean;
  admin_copilot: boolean;
  forecast: boolean;
  daily_digest: boolean;
  issue_grouping: boolean;
}

const DEFAULT_FEATURES: TorqFeatures = {
  rider_assistant: true,
  return_photo_check: true,
  snap_to_report: true,
  id_card_check: true,
  admin_copilot: true,
  forecast: true,
  daily_digest: true,
  issue_grouping: true,
};

export default function CollegeSettingsPage() {
  const queryClient = useQueryClient();
  const { college } = useCollege();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const mapStyle = isDark
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/positron';

  // 1. Fetch college settings
  const { data: collegeData, isLoading: collegeLoading } = useQuery({
    queryKey: ['college-settings', college?.id],
    queryFn: async () => {
      if (!college?.id) return null;
      const { data, error } = await supabase.from('colleges').select('*').eq('id', college.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!college?.id,
  });

  // 2. Fetch AI settings for feature flags
  const { data: aiSettingsData, isLoading: aiLoading } = useQuery({
    queryKey: ['college-ai-settings', college?.id],
    queryFn: async () => {
      if (!college?.id) return null;
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('college_id', college.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!college?.id,
  });

  // Form states
  const [name, setName] = useState('');
  const [maxRideMinutes, setMaxRideMinutes] = useState(60);
  const [strikeLimit, setStrikeLimit] = useState(3);
  const [defaultGeofenceM, setDefaultGeofenceM] = useState(50);
  const [emailDomainsStr, setEmailDomainsStr] = useState('');
  const [centerLat, setCenterLat] = useState(26.5123);
  const [centerLng, setCenterLng] = useState(80.2329);
  const [rulesText, setRulesText] = useState('');
  const [features, setFeatures] = useState<TorqFeatures>(DEFAULT_FEATURES);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when data is loaded
  useEffect(() => {
    if (collegeData) {
      setName(collegeData.name ?? '');
      setMaxRideMinutes(collegeData.max_ride_minutes ?? 60);
      setStrikeLimit(collegeData.strike_limit ?? 3);
      setDefaultGeofenceM(collegeData.default_geofence_m ?? 50);
      setEmailDomainsStr((collegeData.email_domains ?? []).join(', '));
      if (collegeData.center_lat && collegeData.center_lng) {
        setCenterLat(collegeData.center_lat);
        setCenterLng(collegeData.center_lng);
      }
      setRulesText(collegeData.rules_text ?? '');
    }
  }, [collegeData]);

  useEffect(() => {
    if (aiSettingsData?.features) {
      const f = aiSettingsData.features as unknown as Partial<TorqFeatures>;
      setFeatures({
        rider_assistant: f.rider_assistant ?? true,
        return_photo_check: f.return_photo_check ?? true,
        snap_to_report: f.snap_to_report ?? true,
        id_card_check: f.id_card_check ?? true,
        admin_copilot: f.admin_copilot ?? true,
        forecast: f.forecast ?? true,
        daily_digest: f.daily_digest ?? true,
        issue_grouping: f.issue_grouping ?? true,
      });
    }
  }, [aiSettingsData]);

  const handleToggleFeature = (key: keyof TorqFeatures, value: boolean) => {
    setFeatures((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!college?.id) return;

    const trimmedName = name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 120) {
      toast.error('College name must be between 2 and 120 characters.');
      return;
    }

    const domains = emailDomainsStr
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    setIsSaving(true);
    try {
      // 1. Update college settings
      await updateCollegeSettings(supabase, {
        college_id: college.id,
        name: trimmedName,
        max_ride_minutes: maxRideMinutes,
        strike_limit: strikeLimit,
        default_geofence_m: defaultGeofenceM,
        email_domains: domains,
        center_lat: centerLat,
        center_lng: centerLng,
        rules_text: rulesText,
      });

      // 2. Update AI settings feature flags
      await updateAiSettings(supabase, college.id, {
        features: features as unknown as Database['public']['Tables']['ai_settings']['Insert']['features'],
      });

      toast.success('Settings saved.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['college-settings', college.id] }),
        queryClient.invalidateQueries({ queryKey: ['college-ai-settings', college.id] }),
      ]);
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setIsSaving(false);
    }
  };

  if (collegeLoading || aiLoading) {
    return (
      <div className="p-16 text-center font-mono text-xs text-muted flex items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin text-primary" />
        Loading settings...
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 pb-16 max-w-4xl">
      <PageHeader
        kicker={college?.short_code}
        title={en.a12.title}
        lede="Configure operational parameters, ride boundaries, email domains, rules, and TORQ automation features."
        actions={
          <Button
            type="submit"
            disabled={isSaving}
            className="h-10 px-5 rounded-full font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 cursor-pointer shadow-md"
          >
            {isSaving ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="size-3.5 mr-1.5" />
            )}
            {en.a12.save}
          </Button>
        }
      />

      {/* College Info & Identifiers */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="font-display font-bold text-base text-fg">College Information</CardTitle>
          <CardDescription className="text-xs font-mono text-muted">
            Institutional name and unique identifier codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="college-name" className="text-xs font-mono font-medium text-fg">
              College Name
            </Label>
            <Input
              id="college-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Indian Institute of Technology Kanpur"
              maxLength={120}
              required
              className="text-xs font-mono bg-surface2 border-border"
            />
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-muted block">Short Code</span>
              <span className="px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase bg-surface2 text-fg border border-border">
                {collegeData?.short_code ?? college?.short_code}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-mono text-muted block">Bike Prefix</span>
              <span className="px-2.5 py-1 rounded-md font-mono text-xs font-bold uppercase bg-surface2 text-fg border border-border">
                {collegeData?.bike_prefix ?? collegeData?.short_code}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-mono text-muted block">Time Zone</span>
              <span className="px-2.5 py-1 rounded-md font-mono text-xs text-muted bg-surface2 border border-border">
                {collegeData?.time_zone ?? 'Asia/Kolkata'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operational Parameters */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="font-display font-bold text-base text-fg">
            Ride Parameters & Geofence
          </CardTitle>
          <CardDescription className="text-xs font-mono text-muted">
            Limits and thresholds enforced during borrows and returns.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Max ride minutes */}
          <div className="space-y-1.5">
            <Label htmlFor="max-ride" className="text-xs font-mono font-medium text-fg">
              {en.a12.max_ride}
            </Label>
            <Input
              id="max-ride"
              type="number"
              min={15}
              max={1440}
              step={15}
              value={maxRideMinutes}
              onChange={(e) => setMaxRideMinutes(parseInt(e.target.value, 10) || 15)}
              required
              className="h-9 text-xs font-mono bg-surface2 border-border"
            />
            <p className="text-[11px] font-mono text-muted">
              15 to 1440 mins · {Number((maxRideMinutes / 60).toFixed(2))} h
            </p>
          </div>

          {/* Strikes before pass paused */}
          <div className="space-y-1.5">
            <Label htmlFor="strikes" className="text-xs font-mono font-medium text-fg">
              {en.a12.strikes}
            </Label>
            <Input
              id="strikes"
              type="number"
              min={1}
              max={10}
              value={strikeLimit}
              onChange={(e) => setStrikeLimit(parseInt(e.target.value, 10) || 1)}
              required
              className="h-9 text-xs font-mono bg-surface2 border-border"
            />
            <p className="text-[11px] font-mono text-muted">1 to 10 strikes</p>
          </div>

          {/* Default geofence radius */}
          <div className="space-y-1.5">
            <Label htmlFor="geofence" className="text-xs font-mono font-medium text-fg">
              {en.a12.geofence}
            </Label>
            <Input
              id="geofence"
              type="number"
              min={10}
              max={300}
              step={5}
              value={defaultGeofenceM}
              onChange={(e) => setDefaultGeofenceM(parseInt(e.target.value, 10) || 10)}
              required
              className="h-9 text-xs font-mono bg-surface2 border-border"
            />
            <p className="text-[11px] font-mono text-muted">Default radius for new stands</p>
          </div>
        </CardContent>
      </Card>

      {/* Email Domains */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="font-display font-bold text-base text-fg">{en.a12.domains}</CardTitle>
          <CardDescription className="text-xs font-mono text-muted">{en.a12.domains_hint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            id="domains"
            value={emailDomainsStr}
            onChange={(e) => setEmailDomainsStr(e.target.value)}
            placeholder="e.g. iitk.ac.in, alumni.iitk.ac.in"
            className="text-xs font-mono bg-surface2 border-border"
          />
          <p className="text-[11px] font-mono text-muted">Separate multiple domain suffixes with commas.</p>
        </CardContent>
      </Card>

      {/* Map Center */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="font-display font-bold text-base text-fg flex items-center gap-2">
            <MapPin className="size-4 text-primary" />
            {en.a12.center}
          </CardTitle>
          <CardDescription className="text-xs font-mono text-muted">
            Default center point for the live fleet map. Click map or enter coordinates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="center-lat" className="text-xs font-mono font-medium text-fg">
                Center Latitude
              </Label>
              <Input
                id="center-lat"
                type="number"
                step="0.000001"
                value={centerLat}
                onChange={(e) => setCenterLat(parseFloat(e.target.value) || 0)}
                className="h-9 text-xs font-mono bg-surface2 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="center-lng" className="text-xs font-mono font-medium text-fg">
                Center Longitude
              </Label>
              <Input
                id="center-lng"
                type="number"
                step="0.000001"
                value={centerLng}
                onChange={(e) => setCenterLng(parseFloat(e.target.value) || 0)}
                className="h-9 text-xs font-mono bg-surface2 border-border"
              />
            </div>
          </div>

          {/* Embedded small map */}
          <div className="h-64 rounded-xl overflow-hidden border border-border relative">
            <MapView
              mapLib={maplibregl}
              mapStyle={mapStyle}
              initialViewState={{
                latitude: centerLat,
                longitude: centerLng,
                zoom: 15,
              }}
              cursor="crosshair"
              onClick={(e) => {
                setCenterLat(Number(e.lngLat.lat.toFixed(6)));
                setCenterLng(Number(e.lngLat.lng.toFixed(6)));
              }}
              style={{ width: '100%', height: '100%' }}
            >
              <NavigationControl position="bottom-right" />
              <Marker
                latitude={centerLat}
                longitude={centerLng}
                anchor="bottom"
                draggable
                onDrag={(e) => {
                  setCenterLat(Number(e.lngLat.lat.toFixed(6)));
                  setCenterLng(Number(e.lngLat.lng.toFixed(6)));
                }}
                onDragEnd={(e) => {
                  setCenterLat(Number(e.lngLat.lat.toFixed(6)));
                  setCenterLng(Number(e.lngLat.lng.toFixed(6)));
                }}
              >
                <div className="flex flex-col items-center cursor-grab active:cursor-grabbing">
                  <MapPin className="size-8 text-primary fill-primary drop-shadow-md" />
                </div>
              </Marker>
            </MapView>
          </div>
        </CardContent>
      </Card>

      {/* Ride Rules */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <CardTitle className="font-display font-bold text-base text-fg">{en.a12.rules}</CardTitle>
          <CardDescription className="text-xs font-mono text-muted">{en.a12.rules_note}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            rows={7}
            placeholder="Specify college cycling rules, geofence guidelines, hours of operation, and penalties..."
            className="text-xs font-mono bg-surface2 border-border leading-relaxed"
          />
          <p className="text-[11px] font-mono text-muted">
            Markdown formatting is supported. TORQ indexes these rules into its knowledge store.
          </p>
        </CardContent>
      </Card>

      {/* TORQ Feature Switches */}
      <Card className="bg-surface border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <CardTitle className="font-display font-bold text-base text-fg">{en.a12.features}</CardTitle>
          </div>
          <CardDescription className="text-xs font-mono text-muted">
            Enable or disable autonomous TORQ AI capabilities for this college.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 divide-y divide-border/60">
          {/* Rider Assistant */}
          <div className="flex items-center justify-between pt-3 first:pt-0">
            <div className="flex items-start gap-3">
              <Bot className="size-4 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-medium text-fg block">
                  {en.a12.f_rider_assistant}
                </span>
                <p className="text-[11px] font-mono text-muted">
                  In-app chat assistance for riders borrowing bikes and finding stands.
                </p>
              </div>
            </div>
            <Switch
              checked={features.rider_assistant}
              onCheckedChange={(checked) => handleToggleFeature('rider_assistant', checked)}
            />
          </div>

          {/* Return Photo Check */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-4 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-medium text-fg block">
                  {en.a12.f_return_photo_check}
                </span>
                <p className="text-[11px] font-mono text-muted">
                  Vision verification of bike return photos at docking stands.
                </p>
              </div>
            </div>
            <Switch
              checked={features.return_photo_check}
              onCheckedChange={(checked) => handleToggleFeature('return_photo_check', checked)}
            />
          </div>

          {/* Snap to Report */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-start gap-3">
              <Wrench className="size-4 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-medium text-fg block">{en.a12.f_snap_to_report}</span>
                <p className="text-[11px] font-mono text-muted">
                  Automatic issue categorization and defect description from photos.
                </p>
              </div>
            </div>
            <Switch
              checked={features.snap_to_report}
              onCheckedChange={(checked) => handleToggleFeature('snap_to_report', checked)}
            />
          </div>

          {/* ID Card Check at Sign-up */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="size-4 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-medium text-fg block">{en.a12.f_id_card_check}</span>
                <p className="text-[11px] font-mono text-muted">
                  Automated OCR verification of student & staff ID cards upon registration.
                </p>
              </div>
            </div>
            <Switch
              checked={features.id_card_check}
              onCheckedChange={(checked) => handleToggleFeature('id_card_check', checked)}
            />
          </div>

          {/* Admin Copilot */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-start gap-3">
              <Sparkles className="size-4 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-medium text-fg block">{en.a12.f_admin_copilot}</span>
                <p className="text-[11px] font-mono text-muted">
                  Fleet management recommendations and natural language query copilot.
                </p>
              </div>
            </div>
            <Switch
              checked={features.admin_copilot}
              onCheckedChange={(checked) => handleToggleFeature('admin_copilot', checked)}
            />
          </div>

          {/* Demand Forecast and Rebalancing */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-start gap-3">
              <TrendingUp className="size-4 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-medium text-fg block">{en.a12.f_forecast}</span>
                <p className="text-[11px] font-mono text-muted">
                  Hourly stand demand forecasts and rebalancing recommendations.
                </p>
              </div>
            </div>
            <Switch
              checked={features.forecast}
              onCheckedChange={(checked) => handleToggleFeature('forecast', checked)}
            />
          </div>

          {/* Morning Digest */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-start gap-3">
              <FileText className="size-4 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-medium text-fg block">{en.a12.f_daily_digest}</span>
                <p className="text-[11px] font-mono text-muted">
                  Daily morning operations briefings and overnight rebalancing digests.
                </p>
              </div>
            </div>
            <Switch
              checked={features.daily_digest}
              onCheckedChange={(checked) => handleToggleFeature('daily_digest', checked)}
            />
          </div>

          {/* Issue Grouping */}
          <div className="flex items-center justify-between pt-3">
            <div className="flex items-start gap-3">
              <Wrench className="size-4 text-primary mt-0.5" />
              <div className="space-y-0.5">
                <span className="text-xs font-mono font-medium text-fg block">{en.a12.f_issue_grouping}</span>
                <p className="text-[11px] font-mono text-muted">
                  Automatic clustering of multiple rider defect reports into urgent groups.
                </p>
              </div>
            </div>
            <Switch
              checked={features.issue_grouping}
              onCheckedChange={(checked) => handleToggleFeature('issue_grouping', checked)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          disabled={isSaving}
          className="h-10 px-6 rounded-full font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 cursor-pointer shadow-md"
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin mr-1.5" />
          ) : (
            <Check className="size-3.5 mr-1.5" />
          )}
          {en.a12.save}
        </Button>
      </div>
    </form>
  );
}
