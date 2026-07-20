"use strict";exports.id=1986,exports.ids=[1986],exports.modules={15277:(a,b,c)=>{c.d(b,{DV:()=>n,F:()=>g.F,o2:()=>g.o2,tw:()=>g.tw});var d=c(91986),e=c(26218),f=c(6458),g=c(62780);let h={chef:"Chef",maid:"Maid",babysitter:"Babysitter",driver:"Driver",cleaner:"Cleaner",tutor:"Tutor",plumber:"Plumber",electrician:"Electrician"},i=["bg-[linear-gradient(135deg,#3a2417_0%,#8f5a35_40%,#d6b089_100%)]","bg-[linear-gradient(135deg,#d7c0a9_0%,#f2e7d9_45%,#8cb39a_100%)]","bg-[linear-gradient(135deg,#d6c7b2_0%,#f0e3d7_45%,#9e8a72_100%)]","bg-[linear-gradient(135deg,#d8e6db_0%,#f0f6ef_45%,#7aa884_100%)]","bg-[linear-gradient(135deg,#20352b_0%,#2f7d4e_45%,#a7d7a9_100%)]"];function j(a){return g.sR.includes(a)}let k=`
  id,
  marketing_name,
  service_location,
  latitude,
  longitude,
  average_rating,
  total_reviews,
  bio,
  approval_status,
  provider_verifications (
    email_verified,
    phone_verified,
    identity_verified
  ),
  provider_services (
    service_type,
    hourly_rate,
    daily_rate,
    years_experience,
    image_data_urls,
    image_captions,
    provider_service_specialties (
      specialty
    )
  )
`,l=`
  id,
  marketing_name,
  service_location,
  latitude,
  longitude,
  average_rating,
  total_reviews,
  bio,
  approval_status,
  provider_verifications (
    email_verified,
    phone_verified,
    identity_verified
  ),
  provider_services (
    service_type,
    hourly_rate,
    daily_rate,
    years_experience,
    provider_service_specialties (
      specialty
    )
  )
`;async function m(a,b){let c=[...new Set(b.filter(Boolean))];if(0===c.length)return new Map;let{data:d,error:e}=await a.from("profiles").select("id, avatar_url, full_name").in("id",c);return e||!d?new Map:new Map(d.map(a=>[a.id,{avatarUrl:a.avatar_url?.trim()||"",fullName:a.full_name?.trim()||""}]).filter(([,a])=>!!a.avatarUrl||!!a.fullName))}let n=(0,d.cache)(async a=>{let b,c,d=a&&j(a)?a:null,n=(b=(0,f.yt)(),c=(0,f.fo)(),b&&c?(0,e.UU)(b,c,{auth:{autoRefreshToken:!1,persistSession:!1}}):null);if(!n)return{service:d,serviceLabel:d?h[d]:"All Providers",listings:[],errorMessage:"Supabase keys are not configured for provider listings yet."};let o=await n.from("provider_profiles").select(k).eq("is_visible",!0).order("average_rating",{ascending:!1}),p=o.error?.message?.toLowerCase().includes("image_data_urls")?await n.from("provider_profiles").select(l).eq("is_visible",!0).order("average_rating",{ascending:!1}):o,q=p.data??[],r=await m(n,q.map(a=>a.id)),s=q.flatMap((a,b)=>(a.provider_services??[]).flatMap(c=>{let e,f;if(!j(c.service_type)||d&&c.service_type!==d)return[];let k=Array.isArray(a.provider_verifications)?a.provider_verifications[0]:a.provider_verifications,l=r.get(a.id);return[{id:a.id,name:a.marketing_name??"DELLA Provider",providerName:l?.fullName||void 0,serviceKey:c.service_type,serviceLabel:h[c.service_type],title:h[c.service_type],workMode:["Live-in","Part-time","Full-time"][b%3]??"Full-time",location:a.service_location??"Kuala Lumpur",latitude:"number"==typeof a.latitude?a.latitude:null,longitude:"number"==typeof a.longitude?a.longitude:null,distanceKm:[2.4,1.8,3.1,2.7,2.2,4,3.6,2.9][b]??2.5,rating:Number(a.average_rating??4.8),reviews:a.total_reviews??0,hourlyRate:Number(c.hourly_rate??25),dailyRate:Number(c.daily_rate??180),yearsExperience:c.years_experience??"New",specialties:c.provider_service_specialties?.map(a=>a.specialty).filter(a=>!!a).slice(0,2)??[],bio:a.bio??"Trusted services available through DELLA.",availabilityLabel:"Available Today",imageTone:i[b%i.length],isApproved:"approved"===a.approval_status&&!!k?.email_verified,phoneVerified:"approved"===a.approval_status&&!!k?.email_verified&&!!k?.phone_verified,identityVerified:"approved"===a.approval_status&&!!k?.email_verified&&!!k?.identity_verified,profileImageUrl:l?.avatarUrl||(0,g.F)({name:a.marketing_name??"DELLA Provider",serviceKey:c.service_type}),portfolioImages:(e=c.image_data_urls?.map(a=>a?.trim()).filter(Boolean)??[],f=c.image_captions??[],e.map((a,b)=>({src:a,caption:f[b]?.trim()||`Work ${b+1}`})))}]}));return d?{service:d,serviceLabel:h[d],listings:s,errorMessage:p.error?.message??null}:{service:null,serviceLabel:"All Providers",listings:s.slice(0,24),errorMessage:p.error?.message??null}})},62780:(a,b,c)=>{c.d(b,{F:()=>f,o2:()=>e,sR:()=>d,tw:()=>g});let d=["chef","maid","babysitter","driver","cleaner","tutor","plumber","electrician"];function e(a){return`/providers/${encodeURIComponent(a.id)}?service=${a.serviceKey}`}function f(a){let b=a.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),c=`/api/provider-media/${a.serviceKey}/portrait`;if("chef"===a.serviceKey){let a={"chef-amina":"chef-amina.jpg","chef-daniel":"chef-daniel.jpg","chef-mei-ling":"chef-mei-ling.jpg","chef-hikaru":"chef-hikaru.jpg","chef-sofia":"chef-sofia.jpg"}[b];return a?`/Images/Providers/Chef/${a}`:c}if("maid"===a.serviceKey){let a={"siti-maid-service":"siti-maid.jpg","devi-maid-care":"devi-maid.jpg","nora-home-help":"nora-maid.jpg","lina-maid-assist":"lina-maid.jpg","maya-home-service":"maya-maid.jpg"}[b];return a?`/Images/Providers/maid/${a}`:c}if("babysitter"===a.serviceKey){let a={"aisyah-babysitter":"aisha-babysitter.jpg","nur-babysitting":"nur-babysitter.jpg","lina-child-care":"lina-babysitter.jpg","sara-baby-care":"sara-babysitter.jpg","mina-kids-support":"mina-babysitter.jpg"}[b];return a?`/Images/Providers/Babysitter/${a}`:c}if("driver"===a.serviceKey){let a={"driver-kumar":"driver-kumar.jpg","azlan-driver-service":"azlan-driver.jpg","ravi-transport":"ravi-driver.jpg","hakim-private-driver":"hakim-driver.jpg","muthu-driver-link":"muthu-driver.jpg"}[b];return a?`/Images/Providers/Driver/${a}`:c}if("cleaner"===a.serviceKey){let a={"nora-cleaner":"nora-cleaner.jpg","fresh-home-cleaner":"fresha-cleaner.jpg","spark-clean-service":"indra-cleaner.jpg","ecoclean-nora":"nimmin-cleaner.jpg","daily-shine-cleaner":"rani-cleaner.jpg"}[b];return a?`/Images/Providers/Cleaner/${a}`:c}if("tutor"===a.serviceKey){let a={"tutor-farah":"Farah-Tutor.jpg","teacher-aiman":"aiman-tutor.jpg","ms-priya-tutor":"priya-titor.jpg","bm-learning-coach":"erina-tutor.jpg","math-mentor-lee":"nadiya-tutor.jpg"}[b];return a?`/Images/Providers/Tutor/${a}`:c}if("plumber"===a.serviceKey){let a={"plumber-hafiz":"hafiz-plumber.jpg","waterfix-plumber":"guna-plumber.jpg","kl-pipe-service":"karim-plumber.jpg","rapid-plumb-care":"lim-plumber.jpg","home-pipe-expert":"murugan-plumber.jpg"}[b];return a?`/Images/Providers/Plumber/${a}`:c}if("electrician"===a.serviceKey){let a={"electrician-azmi":"azmin-electrician.jpg","brightfix-electric":"aweiz-electrician.jpg","power-home-azhar":"shukri-electrician.jpg","rapid-volt-care":"ilango-electrician.jpg","home-current-pro":"asai-electrcian.jpg"}[b];return a?`/Images/Providers/Electrician/${a}`:c}return c}function g(a){return"chef"!==a&&a?`/api/provider-media/${a}/gallery-2`:"/images/mock/chef-banner.png"}},71986:(a,b,c)=>{c.d(b,{e:()=>l});var d=c(91986),e=c(26218),f=c(6458),g=c(15277),h=c(62780);let i={chef:"Chef",maid:"Maid",tutor:"Tutor",driver:"Driver",cleaner:"Cleaner",babysitter:"Babysitter",plumber:"Plumber",electrician:"Electrician",other:"Other"},j=["chef","maid","babysitter","driver","cleaner","tutor","plumber","electrician"];function k(a){return Array.isArray(a)?a[0]??null:a??null}let l=(0,d.cache)(async()=>{var a;let b,c,d=(b=(0,f.yt)(),c=(0,f.fo)(),b&&c?(0,e.UU)(b,c,{auth:{autoRefreshToken:!1,persistSession:!1}}):null);if(!d)return{greetingName:"Guest",locationLabel:"Kuala Lumpur",categories:j.map(a=>({key:a,label:i[a]??a})),popularProviders:[],popularChefProviders:[],popularElectricianProviders:[],popularMaidProviders:[],upcomingBooking:null,errorMessage:"Supabase keys are not configured for the home feed yet."};let[l,m,n,o,p,q]=await Promise.all([d.from("profiles").select(`
          id,
          full_name,
          customer_profiles (
            city,
            state
          )
        `).eq("role","customer").order("created_at",{ascending:!0}).limit(1).maybeSingle(),d.from("provider_profiles").select(`
          id,
          marketing_name,
          service_location,
          latitude,
          longitude,
          average_rating,
          total_reviews,
          provider_services (
            service_type,
            hourly_rate,
            provider_service_specialties (
              specialty
            )
          )
        `).eq("is_visible",!0).order("average_rating",{ascending:!1}).limit(8),d.from("bookings").select(`
          id,
          booking_status,
          scheduled_date,
          scheduled_start_time,
          provider_profiles (
            marketing_name
          ),
          provider_services (
            service_type
          )
        `).in("booking_status",["pending","accepted","on_the_way","arrived"]).order("scheduled_date",{ascending:!0}).limit(1).maybeSingle(),(0,g.DV)("chef"),(0,g.DV)("electrician"),(0,g.DV)("maid")]),r=l.data;k(r?.customer_profiles);let s=(m.data??[]).map((a,b)=>{var c;let d=a.provider_services?.[0],e=d?.provider_service_specialties?.map(a=>a.specialty).filter(a=>!!a).slice(0,2)??[],f=[2.4,1.8,3.1,2.7,2.2,4,3.6,2.9][b]??2.5;return{id:a.id,serviceKey:d?.service_type??"chef",name:a.marketing_name??"DELLA Provider",fullName:a.marketing_name??"DELLA Provider",service:i[c=d?.service_type??"other"]??c,providerLatitude:"number"==typeof a.latitude?a.latitude:null,providerLongitude:"number"==typeof a.longitude?a.longitude:null,rating:Number(a.average_rating??4.8),reviews:a.total_reviews??0,distanceKm:f,priceLabel:`RM${Number(d?.hourly_rate??25)}/hr`,statusLabel:"Available Today",specialties:e,phoneVerified:!1,identityVerified:!1,portraitSrc:(0,h.F)({name:a.marketing_name??"DELLA Provider",serviceKey:d?.service_type??"chef"})}}),t=n.data,u=k(t?.provider_profiles),v=k(t?.provider_services),w=a=>a.slice(0,5).map(a=>({id:a.id,serviceKey:a.serviceKey,name:a.name,fullName:a.providerName||a.name,service:a.serviceLabel,providerLatitude:a.latitude,providerLongitude:a.longitude,rating:a.rating,reviews:a.reviews,distanceKm:a.distanceKm,priceLabel:`RM${a.hourlyRate}/hr`,statusLabel:a.availabilityLabel,specialties:a.specialties,phoneVerified:a.phoneVerified,identityVerified:a.identityVerified,portraitSrc:a.profileImageUrl})),x=w(o.listings),y=w(p.listings),z=w(q.listings);return{greetingName:"Guest",locationLabel:"Kuala Lumpur",categories:j.map(a=>({key:a,label:i[a]??a})),popularProviders:s,popularChefProviders:x,popularElectricianProviders:y,popularMaidProviders:z,upcomingBooking:t?{id:t.id,title:i[a=v?.service_type??"other"]??a,provider:u?.marketing_name??"DELLA Provider",scheduleLabel:function(a,b){if(!a)return"Upcoming booking";let c=new Date(`${a}T${b??"09:00:00"}`);return new Intl.DateTimeFormat("en-MY",{weekday:"short",hour:"numeric",minute:"2-digit"}).format(c)}(t.scheduled_date,t.scheduled_start_time),statusLabel:"pending"===t.booking_status?"Pending":"accepted"===t.booking_status?"Confirmed":"on_the_way"===t.booking_status?"On the Way":"Arrived"}:null,errorMessage:l.error?.message??m.error?.message??n.error?.message??null}})}};