import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  IdCard,
  MapPin,
  Phone,
  Share2,
  Star,
  Timer,
  ThumbsUp,
} from "lucide-react";
import { EmptyState as SharedEmptyState, SectionTitle, StatusBadge } from "@/app/_components/della-ui";
import { FavoriteProviderButton } from "@/app/_components/favorite-provider-button";
import { notFound } from "next/navigation";

import { BookNowButton } from "./book-now-button";
import { ProviderDistanceText } from "@/app/_components/provider-distance";
import { getProviderDetail } from "@/lib/provider-detail";
import { parseCustomerLocation } from "@/lib/customer-location";

export const dynamic = "force-dynamic";

export default async function ProviderDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ service?: string; lat?: string; lng?: string }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const customerLocation = parseCustomerLocation(new URLSearchParams(searchParams));
  const detail = await getProviderDetail(params.id, searchParams.service ?? null, customerLocation);

  if (!detail) {
    notFound();
  }

  return (
    <main className="min-h-[100dvh] bg-[#fbf8ff]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[430px] bg-[linear-gradient(180deg,#ffffff_0%,#fbf8fe_100%)] px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="py-4">
          <header className="flex items-center justify-between">
            <Link
              href={searchParams.service ? `/providers?service=${searchParams.service}` : "/providers"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f3ebfc] text-[#0F172A]"
            >
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div className="flex items-center gap-2.5">
              <FavoriteProviderButton
                providerId={detail.id}
                serviceKey={detail.serviceKey}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full"
                activeClassName="text-[#E11D48]"
                inactiveClassName="text-[#0F172A]"
              />
              <button
                type="button"
                aria-label="Share provider"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#0F172A]"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </header>

          <section className="mt-4 flex gap-3">
            <div className="relative h-[9.8rem] w-[7.3rem] shrink-0 overflow-hidden rounded-[22px] sm:h-[10.6rem] sm:w-[8.4rem]">
              <Image
                src={detail.profileImage}
                alt={detail.name}
                width={336}
                height={435}
                unoptimized
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-3 left-3 rounded-full bg-white/94 px-2.5 py-1 shadow-[0_8px_18px_rgba(15,23,42,0.08)]">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0F172A]">
                  <span className="h-2 w-2 rounded-full bg-[#8E5EB5]" />
                  Online
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <h1 className="text-[16px] font-extrabold text-[#0F172A] sm:text-[18px]">
                  {detail.name}
                </h1>
                {detail.verified ? (
                  <BadgeCheck className="mt-0.5 h-4.5 w-4.5 shrink-0 fill-[#8E5EB5] text-[#8E5EB5]" />
                ) : null}
              </div>
              <p className="mt-1 text-[13px] text-[#475467]">{detail.title}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-[#344054]">
                <span className="inline-flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                  <span className="font-semibold">{detail.reviewsLabel}</span>
                </span>
              </div>

              <div className="mt-2 flex items-start gap-1.5 text-[12px] font-semibold text-[#8E5EB5]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#8E5EB5]" />
                <span>
                  <ProviderDistanceText
                    distanceKm={detail.distanceKm}
                    suffix=" from you"
                  />
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-left text-[11px] text-[#344054]">
                <InfoPill
                  icon={
                    <IdCard
                      className={`h-4.5 w-4.5 ${detail.identityVerified ? "text-[#16a34a]" : "text-[#f59e0b]"}`}
                    />
                  }
                  label={detail.identityVerified ? "IC Verified" : "IC Pending"}
                />
                <InfoPill
                  icon={
                    <Phone
                      className={`h-4.5 w-4.5 ${detail.phoneVerified ? "text-[#16a34a]" : "text-[#f59e0b]"}`}
                    />
                  }
                  label={detail.phoneVerified ? "Mobile Verified" : "Mobile Pending"}
                />
                <InfoPill icon={<BadgeCheck className="h-4.5 w-4.5 text-[#8E5EB5]" />} label={detail.yearsExperience} />
              </div>
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-3">
            <ProfileStatCard
              icon={<BadgeCheck className="h-5 w-5 fill-[#8E5EB5] text-[#8E5EB5]" />}
              value={String(detail.jobsCompleted)}
              label="Completed Jobs"
            />
            <ProfileStatCard
              icon={<ThumbsUp className="h-5 w-5 text-[#8E5EB5]" />}
              value="98%"
              label="Recommended"
            />
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E6ECE7] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <SectionTitle
              title="Recent Works"
              subtitle={
                detail.hasUploadedGallery
                  ? `${detail.gallery.length} photo${detail.gallery.length === 1 ? "" : "s"} uploaded by this provider`
                  : "This provider has not uploaded recent work photos yet"
              }
            />

            {detail.hasUploadedGallery ? (
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {detail.gallery.map((image) => (
                  <div
                    key={`${detail.id}-${image.src}`}
                    className="relative h-[9.25rem] w-[7.8rem] shrink-0 overflow-hidden rounded-[18px] bg-[#f3f4f6]"
                  >
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.7)_100%)]" />
                    <p className="absolute bottom-2.5 left-2.5 right-2.5 text-[10px] font-semibold leading-4 text-white">
                      {image.caption}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <SharedEmptyState
                  title="No recent works yet"
                  description="Uploaded work photos will appear here after the provider adds them to their profile."
                />
              </div>
            )}
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E6ECE7] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <SectionTitle
              title={`${detail.serviceLabel} Service`}
              action={<StatusBadge label={detail.verified ? "Verified" : "Pending Review"} tone={detail.verified ? "accepted" : "pending"} />}
            />

            <div className="mt-4 rounded-[16px] border border-[#E7ECE7] px-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <PriceMetric
                  label="Per Hour Price"
                  value={`RM ${detail.hourlyRate}`}
                  suffix="/ hour"
                  icon={<Timer className="h-4.5 w-4.5 text-[#475467]" />}
                />
                <div className="border-l border-[#E8ECE8] pl-3">
                  <PriceMetric
                    label="Per Day Price"
                    value={`RM ${detail.dailyRate}`}
                    suffix="/ day"
                    icon={<CalendarDays className="h-4.5 w-4.5 text-[#475467]" />}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-[13px] font-semibold text-[#0F172A]">Specialities</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.specialties.map((specialty) => (
                  <span
                    key={`${detail.id}-${specialty}`}
                    className="rounded-full bg-[#f3ebfc] px-3 py-1.5 text-[12px] font-medium text-[#8E5EB5]"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E6ECE7] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <SectionTitle title={`About ${detail.name}`} />
            <p className="mt-3 text-[13px] leading-6 text-[#344054]">{detail.about}</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center gap-2 text-[13px] font-bold text-[#8E5EB5]"
            >
              Read more
              <ChevronDown className="h-4 w-4" />
            </button>
          </section>

          <section className="mt-5 rounded-[20px] border border-[#E6ECE7] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
            <SectionTitle
              title="Customer Reviews"
              subtitle="Real feedback from completed bookings"
              action={<StatusBadge label={`${detail.rating.toFixed(1)} / 5`} tone="pending" />}
            />

            <div className="mt-4 space-y-3">
              {detail.customerReviews.length === 0 ? (
                <SharedEmptyState
                  title="No reviews yet"
                  description="This provider has not received a customer review yet."
                />
              ) : null}
              {detail.customerReviews.map((review) => (
                <div
                  key={review.id}
                  className="rounded-[16px] border border-[#E7ECE7] bg-[#FBFCFB] p-3.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-[#0F172A]">
                        {review.customerName}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="flex items-center gap-0.5 text-[#F59E0B]">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <Star
                              key={`${review.id}-${value}`}
                              className={`h-3.5 w-3.5 ${
                                value <= Math.round(review.rating)
                                  ? "fill-current"
                                  : "text-[#D0D5DD]"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] font-semibold text-[#344054]">
                          {review.rating.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] text-[#98A2B3]">{review.postedLabel}</span>
                  </div>

                  <p className="mt-3 text-[12px] leading-5 text-[#344054]">
                    {review.comment}
                  </p>

                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {review.images.map((image, index) => (
                      <div
                        key={`${review.id}-${index}`}
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[12px]"
                      >
                        <Image
                          src={image}
                          alt={`${review.customerName} review image ${index + 1}`}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <BookNowButton providerId={detail.id} />
        </div>
      </div>
    </main>
  );
}

function InfoPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="space-y-1.5">
      <div>{icon}</div>
      <p className="leading-4">{label}</p>
    </div>
  );
}

function PriceMetric({
  label,
  value,
  suffix,
  icon,
}: {
  label: string;
  value: string;
  suffix: string;
  icon: ReactNode;
}) {
  return (
    <div>
      <p className="text-[12px] text-[#475467]">{label}</p>
      <div className="mt-2.5 flex items-end gap-1.5">
        <p className="text-[16px] font-extrabold text-[#8E5EB5]">{value}</p>
        <p className="pb-0.5 text-[12px] text-[#344054]">{suffix}</p>
        <span className="ml-auto">{icon}</span>
      </div>
    </div>
  );
}

function ProfileStatCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-[18px] border border-[#E6ECE7] bg-white px-4 py-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f3ebfc] text-[#8E5EB5]">
        {icon}
      </div>
      <p className="mt-3 text-[18px] font-extrabold text-[#0F172A]">{value}</p>
      <p className="mt-1 text-[12px] font-medium text-[#475467]">{label}</p>
    </div>
  );
}
