// Single source of company facts and editable PROPOSED public content.
// Confirm services/equipment before launch; never add unverified business claims.
export const company = {
  name: "Northlane Dispatch",
  email: null as string | null,
  phone: null as string | null,
  address: null as string | null,
  pricing: null as string | null,
  businessClaims: [] as string[],
  testimonials: [] as { quote: string; author: string }[],
  publicContent: {
    status: "proposed" as const,
    heroHeadline: "Keep Your Trucks Moving. Keep Your Business Growing.",
    consultationLabel: "Request a Dispatch Consultation",
    heroDescription: "Dispatch support built around your equipment, preferred lanes and operating priorities. A clear plan for the work ahead.",
    heroImage: {
      src: "/images/truck-concept.png",
      alt: "Concept illustration of an unbranded white semi truck on an open road at sunset",
      caption: "Concept image · illustrative, not company equipment",
    },
    services: [
      { id: "load-sourcing", title: "Load sourcing", icon: "route" as const,
        description: "Review load options against your lanes, equipment and schedule.",
        detail: "Start with the lanes you prefer, the equipment you run and the time you have available. Compare pickup details, delivery requirements and the next leg of your trip before choosing a load.",
        points: ["Lane and equipment fit", "Pickup and delivery requirements", "Scheduling and route considerations"] },
      { id: "rate-negotiation", title: "Rate negotiation", icon: "negotiation" as const,
        description: "Discuss rates and load terms with your operating priorities in mind.",
        detail: "Review the load's details and discuss terms with the broker. The goal is a clear understanding of the rate, timing and requirements before you decide whether to proceed.",
        points: ["Rate and term discussions", "Accessorial questions", "Carrier approval before commitment"] },
      { id: "paperwork-coordination", title: "Paperwork coordination", icon: "paperwork" as const,
        description: "Keep load documents, confirmations and handoffs organized.",
        detail: "Coordinate the exchange of rate confirmations and load-related documents. Define who supplies each document, who reviews it and where it should go so the handoff is clear.",
        points: ["Rate confirmation coordination", "Load document handoffs", "Clear document responsibilities"] },
      { id: "broker-communication", title: "Broker communication", icon: "communication" as const,
        description: "Coordinate load updates and questions between your operation and the broker.",
        detail: "Agree on how dispatch questions and load updates should be handled. Keep the carrier and broker aligned on pickup details, delivery expectations and changes along the way.",
        points: ["Pickup and delivery clarification", "Load status coordination", "Schedule change communication"] },
    ],
    // enabled controls visibility of proposed equipment offerings on public pages.
    equipment: [
      { id: "dry-van", name: "Dry Van", enabled: true,
        description: "Enclosed trailers for general freight. Discuss your lanes, trailer specifications and scheduling needs." },
      { id: "reefer", name: "Reefer", enabled: true,
        description: "Temperature-controlled freight. Outline temperature requirements, appointment windows and equipment capabilities." },
      { id: "flatbed", name: "Flatbed", enabled: true,
        description: "Open-deck freight. Review load dimensions, securement requirements and your operating preferences." },
    ],
    onboarding: [
      { title: "Start with your operation", description: "Discuss your equipment, preferred lanes, schedule and what you need from dispatch." },
      { title: "Review the scope and terms", description: "Confirm responsibilities, service availability and commercial terms before making a commitment." },
      { title: "Prepare the essentials", description: "Agree on required carrier documents, load approval steps and communication preferences." },
      { title: "Plan the first dispatch", description: "Set the working rhythm and review load options together. You approve the next move." },
    ],
  },
};
export const offeredEquipment = company.publicContent.equipment.filter(item => item.enabled);
