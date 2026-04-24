import { useForm } from 'react-hook-form';
import type { Person, CreatePersonInput, Gender } from '../../types';

interface PersonFormProps {
  initial?: Partial<Person>;
  onSubmit: (data: CreatePersonInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark-400 focus:border-transparent transition';

export default function PersonForm({ initial, onSubmit, onCancel, isLoading }: PersonFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreatePersonInput>({
    defaultValues: {
      firstName: initial?.firstName ?? '',
      lastName: initial?.lastName ?? '',
      gender: initial?.gender ?? 'unknown',
      birthDate: initial?.birthDate ?? '',
      birthPlace: initial?.birthPlace ?? '',
      deathDate: initial?.deathDate ?? '',
      deathPlace: initial?.deathPlace ?? '',
      occupation: initial?.occupation ?? '',
      bio: initial?.bio ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First Name" required>
          <input
            {...register('firstName', { required: 'Required' })}
            className={inputCls}
            placeholder="First name"
          />
          {errors.firstName && (
            <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>
          )}
        </Field>
        <Field label="Last Name" required>
          <input
            {...register('lastName', { required: 'Required' })}
            className={inputCls}
            placeholder="Last name"
          />
          {errors.lastName && (
            <p className="text-xs text-red-500 mt-1">{errors.lastName.message}</p>
          )}
        </Field>
      </div>

      <Field label="Gender">
        <select {...register('gender')} className={inputCls}>
          {GENDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Birth Date">
          <input {...register('birthDate')} type="date" className={inputCls} />
        </Field>
        <Field label="Birth Place">
          <input {...register('birthPlace')} className={inputCls} placeholder="City, Country" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Death Date">
          <input {...register('deathDate')} type="date" className={inputCls} />
        </Field>
        <Field label="Death Place">
          <input {...register('deathPlace')} className={inputCls} placeholder="City, Country" />
        </Field>
      </div>

      <Field label="Occupation">
        <input {...register('occupation')} className={inputCls} placeholder="e.g. Farmer, Doctor" />
      </Field>

      <Field label="Biography">
        <textarea
          {...register('bio')}
          className={`${inputCls} resize-none`}
          rows={4}
          placeholder="Write a short biography…"
        />
      </Field>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-bark-600 text-white rounded-lg py-2 text-sm font-medium
            hover:bg-bark-700 active:bg-bark-800 transition disabled:opacity-50"
        >
          {isLoading ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 rounded-lg py-2 text-sm font-medium
            hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
